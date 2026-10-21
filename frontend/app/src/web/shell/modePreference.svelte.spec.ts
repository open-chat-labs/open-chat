import { flushSync } from "svelte";
import { ModePreference } from "./modePreference.svelte";

describe("a shell preference", () => {
    const key = "test_mode_preference";
    let remembers = true;
    let cleanup = () => {};

    function create(fallback = false): ModePreference {
        let preference!: ModePreference;
        cleanup = $effect.root(() => {
            preference = new ModePreference(key, fallback, () => remembers);
        });
        flushSync();
        return preference;
    }

    beforeEach(() => localStorage.clear());
    afterEach(() => {
        cleanup();
        remembers = true;
        localStorage.clear();
    });

    test("starts from its fallback, then from what was remembered", () => {
        expect(create(true).value).toBe(true);
        cleanup();
        create().value = true;
        cleanup();
        expect(create().value).toBe(true);
    });

    test("isn't changed or remembered outside its mode", () => {
        const preference = create();
        remembers = false;
        preference.value = true;
        expect(preference.value).toBe(false);
        cleanup();
        remembers = true;
        expect(create().value).toBe(false);
    });

    test("follows a change made in another tab", () => {
        const preference = create();
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: "true" }));
        expect(preference.value).toBe(true);
        window.dispatchEvent(new StorageEvent("storage", { key: "another", newValue: "false" }));
        expect(preference.value).toBe(true);
    });
});
