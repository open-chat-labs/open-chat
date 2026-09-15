import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SURFACES = [
    "../components/home/profile/ModelManager.svelte",
    "../components_mobile/home/user_profile/ModelManager.svelte",
] as const;

describe("browser Model Manager all-WebGPU parity", () => {
    for (const [index, relative] of SURFACES.entries()) {
        it(`${relative} owns preload, cancellation, progress, settings, retry, and the curated allow-list`, () => {
            const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

            expect(source).toContain("$webGpuModelCatalog.models");
            expect(source).toContain("<WebGpuModelCatalogSettings");
            expect(source).not.toContain("TRANSFORMERS_WEBGPU_MODEL_SPECS");
            expect(source).toContain("transformersWebGpuSelectionCanHandle(spec.id)");
            expect(source).toContain("spec.artifactBytes");
            expect(source).toContain("useWebModelFromUrl");
            expect(source).toContain("refreshWebModelInstallStatus");
            expect(source).toContain("webModelInstallStatus");
            expect(source).toContain('"Downloaded"');
            expect(source).toMatch(
                /await ensureWebModelRestored\(\);\s*await refreshWebModelInstallStatus/,
            );
            expect(source).toContain("webErrorModelId === entry.id");
            expect(source).toContain('? "Retry download"');
            expect(source).toContain('? "Checking download"');
            expect(source).toContain('disabled={$webModelInstallStatus[entry.id] === "checking"}');
            expect(source).toContain("catch (error)");
            expect(source).toContain("cancelWebModelDownload");
            expect(source).toContain("Cancel download");
            expect(source).toContain("Retry download");
            expect(source).toContain("webChoiceGeneration");
            expect(source).toContain('$webModelStatus.status === "downloading"');
            expect(source).toContain('$webModelStatus.status === "verifying"');
            expect(source).toContain("$webModelStatus.progress.received");
            expect(source).toContain("<WebInferenceRuntimeSettings");
            expect(source).toContain("voice add-on optional");
            expect(source).toContain(`context="${index === 0 ? "desktop" : "phone"}"`);
            expect(source).toContain("const nativeClient = isNativeClient();");
            expect(source).toContain("<BrowserImageActionModeSettings />");
            expect(source).not.toContain("{#if !nativeClient}");
            expect(source).toMatch(
                /{#if !native}[\s\S]*<BrowserImageActionModeSettings \/>[\s\S]*{:else}/,
            );
            expect(source).toContain("cancelWebModelDownload();");
            expect(source).not.toContain("webEligibleModels(");
            expect(source).not.toContain('accept=".gguf"');
            expect(source).not.toContain("pickWebModelFromDisk");
            expect(source).not.toContain("setWebModelFile");
        });
    }

    it("keeps explicit OCR modes reachable in the native all-WebGPU route", () => {
        const relative = "../utils/aiActionRunner.ts";
        const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

        expect(source).toContain("const browserLocalReaderModesAllowed = webInference;");
        expect(source).toMatch(
            /webInference\s*&&\s*input\.image !== undefined\s*&&\s*useModelOnly/,
        );
        expect(source).not.toContain("webInference && !isNativeClient()");
        expect(source).toContain("browserUsesLocalReaderOnly()");
        expect(source).toContain("browserUsesModelWithLocalVerification()");
        expect(source).toContain(
            "inferPrivateEvidenceWithPhase: typeof inferOnDeviceTextOnlyNoProjector",
        );
        expect(source).not.toContain("PRIVATE_VERIFICATION_MODEL_ID");
        expect(source).toContain("localImageEvidenceExtractorSupports(def.responseSchema)");
        expect(source).toContain("const useLocalReaderOnly");
        expect(source).toContain("const vision = await runSelectedModel(true)");
        expect(source).toContain(
            "The local image reader could not produce complete evidence, so model verification was not run.",
        );
    });

    it("keeps Gemma voice support as a separately managed optional add-on", () => {
        const source = readFileSync(
            resolve(
                dirname(fileURLToPath(import.meta.url)),
                "../components_shared/WebInferenceRuntimeSettings.svelte",
            ),
            "utf8",
        );

        expect(source).toContain("Voice-message support (optional)");
        expect(source).toContain("Gemma text and image inference works without it.");
        expect(source).toContain("preloadTransformersWebGpuAudio(targetModelId");
        expect(source).toContain("transformersWebGpuAudioDownloaded(targetModelId)");
        expect(source).toContain("deleteTransformersWebGpuAudio(targetModelId)");
        expect(source).toContain("await refreshAudioState(targetModelId, generation);");
        expect(source).toContain("Install voice support");
        expect(source).toContain("Remove voice support");
    });
});
