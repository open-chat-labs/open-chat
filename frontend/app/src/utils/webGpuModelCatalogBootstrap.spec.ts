import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { TRANSFORMERS_WEBGPU_RUNTIME_ASSETS } from "./transformersWebGpuProtocol";
import defaults from "../../public/model-catalog.json";

it("loads the actual packaging asset import in native Node without the browser catalog", () => {
    const rollupFile = resolve(dirname(fileURLToPath(import.meta.url)), "../../rollup.config.mjs");
    const config = readFileSync(rollupFile, "utf8");
    const imports = [
        ...config.matchAll(
            /import\s*\{\s*TRANSFORMERS_WEBGPU_RUNTIME_ASSETS\s*\}\s*from\s*["']([^"']+)["']/gu,
        ),
    ];
    expect(imports).toHaveLength(1);
    const targetFile = resolve(dirname(rollupFile), imports[0][1]);
    const target = pathToFileURL(targetFile).href;
    const child = spawnSync(
        process.execPath,
        [
            "--input-type=module",
            "--eval",
            `
        Object.defineProperty(globalThis, "localStorage", {
            get() { throw new Error("Native packaging must not read browser storage"); }
        });
        const assets = await import(${JSON.stringify(target)});
        process.stdout.write(JSON.stringify(assets.TRANSFORMERS_WEBGPU_RUNTIME_ASSETS));
    `,
        ],
        { encoding: "utf8", timeout: 15_000, env: { ...process.env, NODE_OPTIONS: "" } },
    );
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual(TRANSFORMERS_WEBGPU_RUNTIME_ASSETS);
    expect(readFileSync(targetFile, "utf8")).not.toMatch(
        /model-catalog\.json|webGpuModelCatalog|localStorage/u,
    );
});

afterEach(() => {
    vi.doUnmock("../../public/model-catalog.json");
    vi.resetModules();
    localStorage.clear();
});

for (const [name, models] of [
    ["empty", []],
    ["reordered", [...defaults.models].reverse()],
    ["without Qwen", defaults.models.filter((m) => !m.id.startsWith("qwen"))],
    [
        "without optional audio",
        defaults.models.map((m) => ({
            ...m,
            modalities: m.modalities.filter((modality) => modality !== "audio"),
            optionalAudio: undefined,
        })),
    ],
] as const) {
    it(`boots the actual registry and protocol with a ${name} bundled catalog`, async () => {
        localStorage.clear();
        vi.resetModules();
        const replacement = { ...defaults, models };
        vi.doMock("../../public/model-catalog.json", () => ({ default: replacement }));
        const protocol = await import("./transformersWebGpuProtocol");
        const catalog = await import("./webGpuModelCatalog");
        expect(catalog.currentWebGpuModelCatalog().models.map((m) => m.id)).toEqual(
            models.map((m) => m.id),
        );
        const qwen = models.find((m) => m.id === protocol.PHONE_QWEN3_VL_2B_MODEL_ID);
        const gemma = models.find((m) => m.id === protocol.PHONE_GEMMA4_E2B_MODEL_ID);
        expect(protocol.TRANSFORMERS_QWEN_ARTIFACTS).toEqual(qwen?.artifacts ?? []);
        expect(protocol.TRANSFORMERS_GEMMA_ARTIFACTS).toEqual(gemma?.artifacts ?? []);
        expect(protocol.TRANSFORMERS_GEMMA_AUDIO_ARTIFACTS).toEqual(
            gemma?.optionalAudio?.artifacts ?? [],
        );
        expect(protocol.TRANSFORMERS_GEMMA_ARTIFACT_BYTES).toBe(
            (gemma?.artifacts ?? []).reduce((sum, a) => sum + a.bytes, 0),
        );
    });
}
