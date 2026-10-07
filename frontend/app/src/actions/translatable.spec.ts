import { addMessages, dictionary, locale } from "svelte-i18n";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The real theme module drags in component-lib's svelte components (which vitest's
// svelte plugin can't preprocess) and needs matchMedia. The action only reads
// `theme.accent`, so a stub is enough.
vi.mock("../theme/themes", () => {
    const theme = { accent: "#22a7f2" };
    return {
        currentTheme: {
            subscribe(run: (value: typeof theme) => void) {
                run(theme);
                return () => {};
            },
        },
    };
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

// Only a language we have translations for can be edited, so these are real language codes, and
// setting one as the locale loads its real translations alongside the keys added here
beforeEach(() => {
    addMessages("fr", { some: { thing: "yes" }, top: "level" });
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
        await locale.set("fr");
        const node = mount("some.thing");
        expect(marker(node)).toBeNull();
    });

    test("marker appears when editmode is turned on and disappears when turned off", async () => {
        await locale.set("fr");
        const node = mount("some.thing");

        editmode.set(true);
        const el = marker(node);
        expect(el).not.toBeNull();
        expect(el?.querySelector("svg")).not.toBeNull();

        editmode.set(false);
        expect(marker(node)).toBeNull();
    });

    test("clicking the marker sets the label being edited", async () => {
        await locale.set("fr");
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
        await locale.set("fr");
        const node = mount("some.other.thing");
        editmode.set(true);
        expect(marker(node)).toBeNull();
    });

    test("a top level (non dotted) key resolves", async () => {
        await locale.set("fr");
        const node = mount("top");
        editmode.set(true);
        expect(marker(node)).not.toBeNull();
    });

    test("switching to another non-english locale does not duplicate the marker", async () => {
        addMessages("de", { some: { thing: "ja" } });
        await locale.set("fr");
        const node = mount("some.thing");
        editmode.set(true);
        expect(markerCount()).toBe(1);

        await locale.set("de");
        expect(markerCount()).toBe(1);
        expect(marker(node)).not.toBeNull();
    });

    test("switching to a locale that lacks the key removes the marker", async () => {
        await locale.set("fr");
        const node = mount("some.thing");
        editmode.set(true);
        expect(marker(node)).not.toBeNull();

        await locale.set("it");
        expect(marker(node)).toBeNull();
        expect(markerCount()).toBe(0);
    });

    // Translations are registered per language, so a dialect has no dictionary of its own
    test("a dialect resolves to its language's dictionary", async () => {
        await locale.set("fr-CA");
        const node = mount("some.thing");
        const missing = mount("some.other.thing");
        editmode.set(true);
        expect(marker(node)).not.toBeNull();
        expect(marker(missing)).toBeNull();
    });

    // A successful suggestion is applied to the current locale, which for a dialect creates a
    // dictionary holding nothing but the corrected key
    test("keys stay translatable once a correction has been applied to the dialect", async () => {
        await locale.set("fr-CA");
        const corrected = mount("some.thing");
        const other = mount("top");
        editmode.set(true);

        addMessages("fr-CA", { some: { thing: "corrected" } });

        expect(marker(corrected)).not.toBeNull();
        expect(marker(other)).not.toBeNull();
        expect(marker(mount("top"))).not.toBeNull();
        expect(markerCount()).toBe(3);
    });

    test("no marker for a dialect of english", async () => {
        await locale.set("en-GB");
        const node = mount("some.thing");
        editmode.set(true);
        expect(marker(node)).toBeNull();
    });

    // The toggle for edit mode isn't offered for a language we have no translations for, so
    // nothing is editable in one whatever svelte-i18n holds for it
    test.each(["sv", "sv-SE"])(
        "no marker for an unsupported language (%s)",
        async (unsupported) => {
            addMessages("sv", { some: { thing: "ja" } });
            await locale.set(unsupported);
            const node = mount("some.thing");
            editmode.set(true);
            expect(marker(node)).toBeNull();
        },
    );

    // Chinese and Japanese are "cn" and "jp" to OpenChat
    test.each(["cn", "jp"])(
        "a marker for a language under OpenChat's own code (%s)",
        async (code) => {
            addMessages(code, { some: { thing: "yes" } });
            await locale.set(code);
            const node = mount("some.thing");
            editmode.set(true);
            expect(marker(node)).not.toBeNull();
        },
    );

    test("an undefined key means the action does nothing at all", async () => {
        await locale.set("fr");
        const node = mount(undefined);
        editmode.set(true);
        expect(marker(node)).toBeNull();
    });

    test("update() swaps the key used for the next evaluation", async () => {
        await locale.set("fr");
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
        await locale.set("fr");
        const node = mount("some.thing");
        editmode.set(true);
        expect(marker(node)).not.toBeNull();

        handles.pop()?.destroy();
        expect(marker(node)).not.toBeNull();

        editmode.set(false);
        expect(marker(node)).not.toBeNull();
    });

    test("many nodes all react to a single editmode toggle", async () => {
        await locale.set("fr");
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
        await locale.set("fr");
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
