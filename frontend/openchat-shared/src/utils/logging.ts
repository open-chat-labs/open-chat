export type Logger = {
    error(message: unknown, error: unknown, ...optionalParams: unknown[]): void;
    log(message?: unknown, ...optionalParams: unknown[]): void;
    debug(message?: unknown, ...optionalParams: unknown[]): void;
};

import Rollbar, { type LogArgument } from "rollbar";
import { offline } from "./network";
import { NOOP } from "../constants";
import type { LogLevel } from "../domain/logging";
import { shouldReportError, shouldReportMessage } from "./error";

let rollbar: Rollbar | undefined;

// Pull the strings Rollbar would fingerprint on out of a payload: exception class/message for
// trace items (including chained causes), the body for plain message items
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rollbarPayloadMessages(payload: any): string[] {
    const body = payload?.body;
    const traces = body?.trace_chain ?? (body?.trace ? [body.trace] : []);
    const messages: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const trace of traces as any[]) {
        if (typeof trace?.exception?.class === "string") messages.push(trace.exception.class);
        if (typeof trace?.exception?.message === "string") messages.push(trace.exception.message);
    }
    if (typeof body?.message?.body === "string") messages.push(body.message.body);
    return messages;
}

export function inititaliseLogger(apikey: string, version: string, env: string): Logger {
    if (env === "production") {
        rollbar = Rollbar.init({
            accessToken: apikey,
            captureUncaught: true,
            autoInstrument: false,
            logLevel: "error",
            environment: env,
            enabled: env === "production",
            captureUnhandledRejections: true,
            // Noise with no fix on our side: opaque cross-origin "Script error." (injected
            // scripts, extensions), and Chrome extension messaging failures
            ignoredMessages: [
                "Script error.",
                "Could not establish connection. Receiving end does not exist.",
            ],
            // captureUncaught / captureUnhandledRejections bypass our logger, so uncaught
            // items get the same noise filtering at the transport layer. Logger-reported items
            // (isUncaught false) already passed shouldReportError and are not re-filtered here.
            checkIgnore: (isUncaught, _args, payload) =>
                isUncaught && rollbarPayloadMessages(payload).some((m) => !shouldReportMessage(m)),
            payload: {
                environment: env,
                client: {
                    javascript: {
                        source_map_enabled: true,
                        code_version: version,
                        guess_uncaught_frames: true,
                    },
                },
            },
        });
    }
    return {
        error(message: unknown, error: unknown, ...optionalParams: unknown[]): void {
            if (!shouldReportError(error)) {
                console.debug("Expected failure (not reported): ", message, error);
                return;
            }

            console.error(message as string, error, optionalParams);
            if (!offline()) {
                rollbar?.error(error as LogArgument, message as LogArgument, optionalParams);
            }
        },
        log(message?: unknown, ...optionalParams: unknown[]): void {
            console.log(message as string, optionalParams);
        },
        debug(message?: unknown, ...optionalParams: unknown[]): void {
            console.debug(message as string, optionalParams);
        },
    };
}

const DEFAULT_DEBUG = console.debug;
const DEFAULT_LOG = console.log;
const DEFAULT_WARN = console.warn;

export function setMinLogLevel(level: LogLevel) {
    const levelAsInt = level === "debug" ? 0 : level === "log" ? 1 : level === "warn" ? 2 : 3;
    const debugEnabled = levelAsInt <= 0;
    const logEnabled = levelAsInt <= 1;
    const warnEnabled = levelAsInt <= 2;

    console.debug = debugEnabled ? DEFAULT_DEBUG : NOOP;
    console.log = logEnabled ? DEFAULT_LOG : NOOP;
    console.warn = warnEnabled ? DEFAULT_WARN : NOOP;
}

export function debug<T>(data: T, msg?: string): T {
    if (msg) {
        console.log(msg, data);
    } else {
        console.log(data);
    }
    return data;
}

export function logDuration(msg: string, started: number): void {
    console.debug(`PERF: ${msg}`, Date.now() - started);
}
