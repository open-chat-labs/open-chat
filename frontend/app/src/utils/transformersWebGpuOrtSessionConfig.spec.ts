// @vitest-environment node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { compileFunction } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
    patchTransformersWebGpuOrtSessionConfig,
    transformersWebGpuOrtSessionConfigPlugin,
    TRANSFORMERS_WEBGPU_ORT_CONFIG_SOURCE_SHA256,
    TRANSFORMERS_WEBGPU_ORT_CONFIG_PATCHED_SHA256,
} from "../../transformersWebGpuOrtSessionConfig.mjs";

const id = path.resolve(
    import.meta.dirname,
    "../../../node_modules/onnxruntime-web/dist/ort.jspi.min.mjs",
);
const source = fs.readFileSync(id, "utf8");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const original = "n.executionProviders&&await pn(r,n,o)";

describe("Pinned ORT WebGPU provider configuration ordering", () => {
    it("reverses to the exact source and preserves module syntax and the qualified output hash", () => {
        expect(hash(source)).toBe(TRANSFORMERS_WEBGPU_ORT_CONFIG_SOURCE_SHA256);
        const patched = patchTransformersWebGpuOrtSessionConfig(source, id)!;
        expect(hash(patched)).toBe(TRANSFORMERS_WEBGPU_ORT_CONFIG_PATCHED_SHA256);
        expect(patched.length - source.length).toBe(112);
        const prefix =
            'n.extra?.["ep.webgpuexecutionprovider.enableInt64"]==="1"&&Ee(r,"ep.webgpuexecutionprovider.enableInt64","1",o),';
        expect(patched.split(prefix).length).toBe(2);
        expect(patched.replace(prefix, "")).toBe(source);
        const parsed = ts.createSourceFile(
            "ort.mjs",
            patched,
            ts.ScriptTarget.ESNext,
            true,
            ts.ScriptKind.JS,
        );
        expect((parsed as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics).toEqual([]);
    });

    it.each([
        undefined,
        {},
        { "ep.webgpuexecutionprovider.enableInt64": "0" },
        { "ep.webgpuexecutionprovider.enableInt64": 1 },
        { "ep.webgpuexecutionprovider.enableInt64": "1" },
    ])(
        "forwards only explicit requested INT64 before the unchanged provider call: %j",
        async (extra) => {
            const patched = patchTransformersWebGpuOrtSessionConfig(source, id)!;
            const end = patched.indexOf(original) + original.length;
            const start = patched.lastIndexOf(
                'n.extra?.["ep.webgpuexecutionprovider.enableInt64"]',
                end,
            );
            const body = patched.slice(start, end),
                events: unknown[] = [];
            const options = {
                executionProviders: [{ name: "webgpu", preferredLayout: "NCHW" }],
                extra,
            };
            const callback = compileFunction(`return (async () => { ${body}; })();`, [
                "n",
                "r",
                "o",
                "Ee",
                "pn",
            ]);
            const handle = {},
                context = {};
            await callback(
                options,
                handle,
                context,
                (...args: unknown[]) => {
                    events.push(["extra", ...args]);
                },
                async (...args: unknown[]) => {
                    events.push(["provider", ...args]);
                },
            );
            const expected: unknown[] = [];
            if (extra?.["ep.webgpuexecutionprovider.enableInt64"] === "1") {
                expected.push([
                    "extra",
                    handle,
                    "ep.webgpuexecutionprovider.enableInt64",
                    "1",
                    context,
                ]);
            }
            expected.push(["provider", handle, options, context]);
            expect(events).toEqual(expected);
        },
    );

    it("rejects source changes or repeated patching and ignores unrelated runtime modules", () => {
        expect(() => patchTransformersWebGpuOrtSessionConfig(source + "\n", id)).toThrow(
            /source changed/,
        );
        expect(() =>
            patchTransformersWebGpuOrtSessionConfig(
                patchTransformersWebGpuOrtSessionConfig(source, id),
                id,
            ),
        ).toThrow(/source changed/);
        for (const other of [
            "worker.js",
            id + "?unknown",
            id.replace("ort.jspi.min.mjs", "ort.webgpu.min.mjs"),
        ]) {
            expect(patchTransformersWebGpuOrtSessionConfig(source, other)).toBeNull();
        }
        expect(
            patchTransformersWebGpuOrtSessionConfig(source, id.replaceAll("/", "\\")),
        ).not.toBeNull();
    });

    it("requires exactly one patch per model-worker build and resets for a subsequent rebuild", () => {
        const plugin = transformersWebGpuOrtSessionConfigPlugin();
        plugin.buildStart();
        expect(plugin.transform(source, "other.js")).toBeNull();
        expect(() => plugin.buildEnd(undefined)).toThrow(/did not apply/);
        expect(plugin.transform(source, id)?.code).toBe(
            patchTransformersWebGpuOrtSessionConfig(source, id),
        );
        expect(() => plugin.buildEnd(undefined)).not.toThrow();
        expect(() => plugin.transform(source, id)).toThrow(/more than once/);
        plugin.buildStart();
        expect(() => plugin.buildEnd(new Error("original build failure"))).not.toThrow();
        plugin.transform(source, id);
        expect(() => plugin.buildEnd(undefined)).not.toThrow();
    });
});
