import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";
import { clearWebModel, restoreWebModel, setWebModelFile, webModelStatus } from "./webInference";

// Pins the id-tracking contract the always-visible browser chooser relies on: webModelStatus carries
// the CATALOG id of the attached model (so the chooser can mark it "Current"), and the id is cleared
// whenever the source is not a catalog entry (disk file) or the model is removed.

const LS_URL_MODEL = "openchat_web_model_url";

describe("webModelStatus id tracking", () => {
    beforeEach(async () => {
        await clearWebModel();
        localStorage.clear();
    });

    it("restoreWebModel publishes the saved catalog id so the chooser can mark the current model", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({
                id: "qwen2.5-0.5b-instruct-q4",
                name: "Qwen2.5 0.5B (instruct)",
                url: "https://host/models/qwen2.5-0.5b.gguf",
            }),
        );
        await restoreWebModel();
        const status = get(webModelStatus);
        expect(status.status).toBe("attached");
        expect(status.name).toBe("Qwen2.5 0.5B (instruct)");
        expect(status.id).toBe("qwen2.5-0.5b-instruct-q4");
    });

    it("attaching a session disk file clears the catalog id (disk files have no catalog row)", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({
                id: "qwen2.5-0.5b-instruct-q4",
                name: "Qwen2.5 0.5B (instruct)",
                url: "https://host/models/qwen2.5-0.5b.gguf",
            }),
        );
        await restoreWebModel();
        const err = await setWebModelFile(new File([new Uint8Array(8)], "local-model.gguf"));
        expect(err).toBeUndefined();
        const status = get(webModelStatus);
        expect(status.status).toBe("attached");
        expect(status.name).toBe("local-model.gguf");
        expect(status.id).toBeUndefined();
    });

    it("clearWebModel clears the id along with the rest of the state", async () => {
        localStorage.setItem(
            LS_URL_MODEL,
            JSON.stringify({ id: "gemma-3-1b-it-q4", name: "Gemma 3 1B", url: "https://host/g.gguf" }),
        );
        await restoreWebModel();
        expect(get(webModelStatus).id).toBe("gemma-3-1b-it-q4");
        await clearWebModel();
        const status = get(webModelStatus);
        expect(status.status).toBe("none");
        expect(status.id).toBeUndefined();
        expect(status.name).toBeUndefined();
    });
});
