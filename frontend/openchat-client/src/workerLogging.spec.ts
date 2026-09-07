import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldReportError, shouldReportWorkerError } from "../../openchat-shared/src/utils/error";
import { inititaliseLogger } from "../../openchat-shared/src/utils/logging";

const tracker = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("rollbar", () => ({ default: { init: () => tracker } }));
vi.mock("../../openchat-shared/src/utils/network", () => ({ offline: () => false }));

// Execute the actual worker declarations/listeners, not a handwritten equivalent. Avoid
// booting identity/canister services: the real shared logger remains the tested boundary.
function workerLoggingHarness() {
    const source = ts.createSourceFile(
        "worker.ts",
        readFileSync(resolve(__dirname, "../../openchat-worker/src/worker.ts"), "utf8"),
        ts.ScriptTarget.Latest,
        true,
    );
    const statements = source.statements.filter((statement) => {
        if (ts.isFunctionDeclaration(statement)) {
            return ["coarseErrorClass", "redactedWorkerError"].includes(statement.name?.text ?? "");
        }
        if (ts.isVariableStatement(statement)) {
            return statement.declarationList.declarations.some(
                (declaration) => declaration.name.getText(source) === "sendError",
            );
        }
        if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
            return false;
        }
        const call = statement.expression;
        return (
            call.expression.getText(source) === "self.addEventListener" &&
            ts.isStringLiteral(call.arguments[0]) &&
            ["error", "unhandledrejection"].includes(call.arguments[0].text)
        );
    });
    const handlers = new Map<string, (event: Record<string, unknown>) => void>();
    const postMessage = vi.fn();
    const code = ts.transpileModule(
        statements.map((statement) => statement.getText(source)).join("\n"),
        {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
        },
    ).outputText;
    const sendError = new Function(
        "logger",
        "postMessage",
        "shouldReportWorkerError",
        "shouldReportError",
        "self",
        `${code}\nreturn sendError;`,
    )(
        inititaliseLogger("test-only-not-a-key", "test", "production"),
        postMessage,
        shouldReportWorkerError,
        shouldReportError,
        {
            addEventListener: (kind: string, callback: (event: Record<string, unknown>) => void) =>
                handlers.set(kind, callback),
        },
    ) as (kind: string, correlationId: number) => (error: unknown) => void;
    expect(handlers.size).toBe(2);
    return { sendError, handlers, postMessage };
}

function expectRedactedPrimaryError(expectedClass: string, secret: string): void {
    expect(tracker.error).toHaveBeenCalledTimes(1);
    const primary = tracker.error.mock.calls[0][0] as Error;
    expect(primary).toBeInstanceOf(Error);
    expect(primary.name).toBe(expectedClass);
    expect(primary.message).toBe("Worker failure details redacted");
    expect(primary.stack).toBeUndefined();
    expect(primary.cause).toBeUndefined();
    for (const calls of [
        tracker.error.mock.calls,
        vi.mocked(console.error).mock.calls,
        vi.mocked(console.debug).mock.calls,
    ]) {
        expect(
            JSON.stringify(calls, (_key, value) =>
                value instanceof Error
                    ? Object.fromEntries(
                          Object.getOwnPropertyNames(value).map((key) => [
                              key,
                              (value as unknown as Record<string, unknown>)[key],
                          ]),
                      )
                    : value,
            ),
        ).not.toContain(secret);
    }
}

describe("worker logging through the real shared logger", () => {
    beforeEach(() => {
        tracker.error.mockClear();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(console, "debug").mockImplementation(() => undefined);
    });

    afterEach(() => vi.restoreAllMocks());

    it("uses a bounded redacted Error as tracker primary while returning the original failure to its caller", () => {
        const { sendError, postMessage } = workerLoggingHarness();
        const secret = "private-card-bearer-123";
        const failure = new TypeError(secret, { cause: new Error(secret) });
        failure.name = secret;
        failure.stack = secret;
        const serialized = JSON.stringify(failure, Object.getOwnPropertyNames(failure));
        sendError("createAiAppCardProvenance", 17)(failure);
        expectRedactedPrimaryError("TypeError", secret);
        expect(postMessage).toHaveBeenCalledWith({
            kind: "worker_error",
            requestKind: "createAiAppCardProvenance",
            correlationId: 17,
            error: serialized,
        });
    });

    it("never forwards an arbitrary serialized error name into telemetry", () => {
        const { sendError } = workerLoggingHarness();
        const secret = "untrusted-error-name-and-message";
        sendError("getUpdates", 3)({ name: secret, message: secret, stack: secret });
        expectRedactedPrimaryError("Error", secret);
    });

    it("continues filtering expected request errors before redaction without changing their reply", () => {
        const { sendError, postMessage } = workerLoggingHarness();
        sendError("getUpdates", 5)(new TypeError("Failed to fetch"));
        expect(tracker.error).not.toHaveBeenCalled();
        expect(postMessage).toHaveBeenCalledOnce();
    });

    it.each(["error", "unhandledrejection"])(
        "filters expected %s failures before redaction",
        (kind) => {
            const { handlers } = workerLoggingHarness();
            const failure = new TypeError("Failed to fetch");
            handlers.get(kind)!({ error: failure, reason: failure });
            expect(tracker.error).not.toHaveBeenCalled();
        },
    );

    it.each(["error", "unhandledrejection"])(
        "redacts unexpected %s failures without losing their bounded class",
        (kind) => {
            const { handlers } = workerLoggingHarness();
            const secret = "private-image-response";
            const failure = new RangeError(secret, { cause: new Error(secret) });
            failure.name = secret;
            failure.stack = secret;
            handlers.get(kind)!({ error: failure, reason: failure, message: secret });
            expectRedactedPrimaryError("RangeError", secret);
        },
    );
});
