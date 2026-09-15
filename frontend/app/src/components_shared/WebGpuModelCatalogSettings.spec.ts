import { flushSync, tick } from "svelte";
import { createClassComponent } from "svelte/legacy";
import { afterEach, expect, it, vi } from "vitest";
import WebGpuModelCatalogSettings from "./WebGpuModelCatalogSettings.svelte";
import { applyWebGpuModelCatalog, currentWebGpuModelCatalog } from "../utils/webGpuModelCatalog";
import defaults from "../../public/model-catalog.json";

const cleanup: (() => void)[] = [];
afterEach(() => {
    cleanup.splice(0).forEach((fn) => fn());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    applyWebGpuModelCatalog(defaults, false);
    localStorage.clear();
});
function render(busy = false) {
    const target = document.createElement("div");
    document.body.append(target);
    const component = createClassComponent({
        component: WebGpuModelCatalogSettings,
        target,
        props: { busy },
    });
    cleanup.push(() => {
        component.$destroy();
        target.remove();
    });
    flushSync();
    return target;
}
async function settle() {
    await tick();
    await tick();
    await tick();
    flushSync();
}
async function importJson(target: HTMLElement, text: string) {
    const input = target.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
        configurable: true,
        value: [{ size: text.length, text: async () => text }],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
}
it("imports JSON through the actual shared UI and updates the reactive catalog without touching weights", async () => {
    const remove = vi.fn();
    vi.stubGlobal("caches", { delete: remove });
    const target = render();
    await importJson(
        target,
        JSON.stringify({ schemaVersion: 1, version: "ui-config-2", models: [] }),
    );
    expect(currentWebGpuModelCatalog().models).toEqual([]);
    expect(target.textContent).toContain("ui-config-2");
    expect(target.textContent).toContain("No models are enabled");
    expect(target.textContent).toContain("Downloaded weights were retained");
    expect(remove).not.toHaveBeenCalled();
});
it("shows an import error while keeping the current catalog", async () => {
    const target = render();
    await importJson(target, "{}");
    expect(target.querySelector('[role="alert"]')).not.toBeNull();
    expect(currentWebGpuModelCatalog().models).toHaveLength(2);
});
it("blocks imports and refresh while model operations are busy", () => {
    const target = render(true);
    expect(
        [...target.querySelectorAll("input,button")].every(
            (node) => (node as HTMLInputElement).disabled,
        ),
    ).toBe(true);
});
it("requires explicit confirmation before deleting an inactive download", async () => {
    applyWebGpuModelCatalog({ ...defaults, models: [] }, false);
    const remove = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { delete: remove });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    const target = render();
    const button = [...target.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Delete retained"),
    )!;
    button.click();
    await settle();
    expect(remove).not.toHaveBeenCalled();
});
