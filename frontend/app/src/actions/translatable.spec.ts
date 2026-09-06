import { addMessages, dictionary, locale } from "svelte-i18n";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The real theme module drags in component-lib's svelte components (which vitest's
// svelte plugin can't preprocess) and needs matchMedia. The action only reads
// `theme.accent`, so a stub is enough.
vi.mock("../theme/themes", async () => {
    const { readable } = await import("svelte/store");
    return { currentTheme: readable({ accent: "#22a7f2" }) };
});

import { editingLabel, editmode, i18nKey } from "../i18n/i18n";
import { translatable } from "./translatable";

type Handle = ReturnType<typeof translatable>;

const handles: Handle[] = [];

function mount(key: string | undefined, parent?: HTMLElement): HTMLElement {
    const container = parent ?? document.body.appendChild(document.createElement("div"));
    const node = container.appendChild(document.createElement("span"));
    const handle = translatable(node, { key: key === undefined ? undefined : i18nKey(key) });
    handles.push(handle);
    return node;
}

function marker(node: HTMLElement): Element | null {
    const next = node.nextSibling;
    return next instanceof Element && next.classList.contains("is-translatable") ? next : null;
}

function markerCount(): number {
    return document.querySelectorAll(".is-translatable").length;
}

beforeEach(() => {
    addMessages("xx", { some: { thing: "yes" }, top: "level" });
    addMessages("en", { some: { thing: "yes" } });
});

afterEach(() => {
    handles.forEach((h) => h?.destroy());
    handles.length = 0;
    editmode.set(false);
    editingLabel.set(undefined);
    document.body.innerHTML = "";
});

describe("translatable action", () => {
    test("no marker while editmode is off", async () => {
        await locale.set("xx");
        const node = mount("some.thing");
        expect(marker(node)).toBeNull();
    });

    test("marker appears when editmode is turned on and disappears when turned off", async () => {
        await locale.set("xx");
        const node = mount("some.thing");

        editmode.set(true);
        const el = marker(node);
        expect(el).not.toBeNull();
        expect(el?.querySelector("svg")).not.toBeNull();

        editmode.set(false);
        expect(marker(node)).toBeNull();
    });

    test("clicking the marker sets the label being edited", async () => {
        await locale.set("xx");
        const node = mount("some.thing");
        editmode.set(true);

        marker(node)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

        expect(editingLabel).toBeDefined();
        let edited: unknown;
        editingLabel.subscribe((v) => (edited = v))();
        expect(edited).toMatchObject({ key: "some.thing" });
    });

    test("no marker for an english locale", async () => {
        await locale.set("en");
        const node = mount("some.thing");
        editmode.set(true);
        expect(marker(node)).toBeNull();
    });

    test("no marker when the key is missing from the dictionary", async () => {
        await locale.set("xx");
        const node = mount("some.other.thing");
        editmode.set(true);
        expect(marker(node)).toBeNull();
    });

    test("a top level (non dotted) key resolves", async () => {
        await locale.set("xx");
        const node = mount("top");
        editmode.set(true);
        expect(marker(node)).not.toBeNull();
    });

    test("switching to another non-english locale does not duplicate the marker", async () => {
        addMessages("yy", { some: { thing: "oui" } });
        await locale.set("xx");
        const node = mount("some.thing");
        editmode.set(true);
        expect(markerCount()).toBe(1);

        await locale.set("yy");
        expect(markerCount()).toBe(1);
        expect(marker(node)).not.toBeNull();
    });

    test("switching to a locale that lacks the key removes the marker", async () => {
        addMessages("zz", { other: "thing" });
        await locale.set("xx");
        const node = mount("some.thing");
        editmode.set(true);
        expect(marker(node)).not.toBeNull();

        await locale.set("zz");
        expect(marker(node)).toBeNull();
        expect(markerCount()).toBe(0);
    });

    test("an undefined key means the action does nothing at all", async () => {
        await locale.set("xx");
        const node = mount(undefined);
        editmode.set(true);
        expect(marker(node)).toBeNull();
    });

    test("update() swaps the key used for the next evaluation", async () => {
        await locale.set("xx");
        const node = mount("some.other.thing");
        const handle = handles[handles.length - 1];

        handle?.update?.({ key: i18nKey("some.thing") });
        editmode.set(true);

        expect(marker(node)).not.toBeNull();
    });

    // Current behaviour, pinned deliberately: destroy() only unsubscribes, it does
    // not remove an already inserted marker (Svelte removes the node the action is
    // attached to, but the marker is a *sibling* it does not own).
    test("destroy leaves an inserted marker in place", async () => {
        await locale.set("xx");
        const node = mount("some.thing");
        editmode.set(true);
        expect(marker(node)).not.toBeNull();

        handles.pop()?.destroy();
        expect(marker(node)).not.toBeNull();

        editmode.set(false);
        expect(marker(node)).not.toBeNull();
    });

    test("many nodes all react to a single editmode toggle", async () => {
        await locale.set("xx");
        for (let i = 0; i < 20; i++) {
            mount("some.thing");
        }
        expect(markerCount()).toBe(0);

        editmode.set(true);
        expect(markerCount()).toBe(20);

        editmode.set(false);
        expect(markerCount()).toBe(0);
    });

    test("locale and dictionary are subscribed to once, not once per node", async () => {
        await locale.set("xx");
        const localeSubs = vi.spyOn(locale, "subscribe");
        const dictionarySubs = vi.spyOn(dictionary, "subscribe");

        for (let i = 0; i < 20; i++) {
            mount("some.thing");
        }

        expect(localeSubs.mock.calls.length).toBeLessThanOrEqual(1);
        expect(dictionarySubs.mock.calls.length).toBeLessThanOrEqual(1);

        localeSubs.mockRestore();
        dictionarySubs.mockRestore();
    });
});
