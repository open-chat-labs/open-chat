import { layoutOverrideOf, layoutSwitchAt, selectLayout, type LayoutInputs } from "./layout";

// A desktop browser at 1200px with no flags; each test changes what it's about
function inputs(overrides: Partial<LayoutInputs>): LayoutInputs {
    return {
        mobileLayoutFlag: undefined,
        webLayoutFlag: undefined,
        nativeLayoutFlag: undefined,
        width: 1200,
        coarsePointer: false,
        canHover: true,
        nativeApp: false,
        override: undefined,
        ...overrides,
    };
}

// The old signature's four inputs, for the cases from before the native layout
function legacy(
    mobileLayoutFlag: string | undefined,
    webLayoutFlag: string | undefined,
    isMobileWidth: boolean,
    nativeApp: boolean,
) {
    return selectLayout(
        inputs({ mobileLayoutFlag, webLayoutFlag, width: isMobileWidth ? 400 : 1200, nativeApp }),
    );
}

describe("selectLayout without the native flag", () => {
    test("v2 flag on a narrow viewport selects the mobile app", () => {
        expect(legacy("v2", undefined, true, false)).toBe("v2");
    });
    test("v2 flag on a wide viewport selects the desktop app", () => {
        expect(legacy("v2", undefined, false, false)).toBe("v1");
    });
    test("v1 flag always selects the desktop app", () => {
        expect(legacy("v1", undefined, true, false)).toBe("v1");
        expect(legacy("v1", undefined, false, false)).toBe("v1");
    });
    test("missing flags select the desktop app", () => {
        expect(legacy(undefined, undefined, true, false)).toBe("v1");
        expect(legacy(undefined, undefined, false, false)).toBe("v1");
    });
    test("v3 web flag on a wide viewport selects the new web app", () => {
        expect(legacy(undefined, "v3", false, false)).toBe("v3");
        expect(legacy("v2", "v3", false, false)).toBe("v3");
    });
    test("v3 web flag on a narrow viewport keeps the existing apps", () => {
        expect(legacy(undefined, "v3", true, false)).toBe("v1");
        expect(legacy("v2", "v3", true, false)).toBe("v2");
    });
    test("v3 web flag in a native app keeps the existing apps", () => {
        expect(legacy(undefined, "v3", false, true)).toBe("v1");
        expect(legacy("v2", "v3", false, true)).toBe("v1");
        expect(legacy("v2", "v3", true, true)).toBe("v2");
    });
    test("any other web flag value is ignored", () => {
        expect(legacy(undefined, "v4", false, false)).toBe("v1");
    });
    test("ignores the pointer and the stored override", () => {
        const phone = { width: 400, coarsePointer: true, canHover: false };
        expect(selectLayout(inputs({ ...phone, mobileLayoutFlag: "v2" }))).toBe("v2");
        expect(
            selectLayout(inputs({ ...phone, override: "desktop", mobileLayoutFlag: "v2" })),
        ).toBe("v2");
        expect(selectLayout(inputs({ override: "mobile", webLayoutFlag: "v3" }))).toBe("v3");
    });
    test("any other native flag value is ignored", () => {
        expect(selectLayout(inputs({ nativeLayoutFlag: "v3", nativeApp: true }))).toBe("v1");
    });
});

describe("selectLayout with the native flag", () => {
    const native = { nativeLayoutFlag: "v4" };
    const phone = { ...native, width: 390, coarsePointer: true, canHover: false };
    const tablet = { ...native, coarsePointer: true, canHover: false };

    test("the apps always get the native tree", () => {
        for (const width of [390, 800, 1400]) {
            expect(selectLayout(inputs({ ...native, nativeApp: true, width })), `${width}`).toBe(
                "v4",
            );
        }
        expect(selectLayout(inputs({ ...native, nativeApp: true, override: "desktop" }))).toBe(
            "v4",
        );
    });

    test("a phone's browser gets the native tree", () => {
        expect(selectLayout(inputs(phone))).toBe("v4");
        // whatever the build's other flags say
        expect(
            selectLayout(inputs({ ...phone, mobileLayoutFlag: "v2", webLayoutFlag: "v3" })),
        ).toBe("v4");
    });

    test("a narrow viewport that isn't a desktop pointer's gets the native tree", () => {
        // a phone that says it can hover
        expect(selectLayout(inputs({ ...native, width: 390, coarsePointer: true }))).toBe("v4");
        // no pointer at all
        expect(selectLayout(inputs({ ...native, width: 390, canHover: false }))).toBe("v4");
    });

    test("a narrow desktop window gets the native tree too: the web UI is for desktop widths", () => {
        expect(selectLayout(inputs({ ...native, width: 600 }))).toBe("v4");
        expect(selectLayout(inputs({ ...native, width: 767, webLayoutFlag: "v3" }))).toBe("v4");
        expect(selectLayout(inputs({ ...native, width: 768, webLayoutFlag: "v3" }))).toBe("v3");
    });

    test("a tablet gets the native tree in portrait and the desktop site in landscape", () => {
        expect(selectLayout(inputs({ ...tablet, width: 820 }))).toBe("v4");
        expect(selectLayout(inputs({ ...tablet, width: 1023 }))).toBe("v4");
        expect(selectLayout(inputs({ ...tablet, width: 1024, webLayoutFlag: "v3" }))).toBe("v3");
    });

    test("a desktop browser gets the desktop site: the new web UI in a build with it", () => {
        expect(selectLayout(inputs(native))).toBe("v1");
        expect(selectLayout(inputs({ ...native, webLayoutFlag: "v3" }))).toBe("v3");
    });

    test("the stored override beats the automatic rule in a browser", () => {
        expect(selectLayout(inputs({ ...phone, override: "desktop" }))).toBe("v1");
        expect(selectLayout(inputs({ ...phone, override: "desktop", webLayoutFlag: "v3" }))).toBe(
            "v3",
        );
        expect(selectLayout(inputs({ ...native, override: "mobile" }))).toBe("v4");
    });
});

describe("the stored layout override", () => {
    test("is the one picked", () => {
        expect(layoutOverrideOf("mobile")).toBe("mobile");
        expect(layoutOverrideOf("desktop")).toBe("desktop");
    });

    test("is none for nothing stored or anything else", () => {
        expect(layoutOverrideOf(null)).toBeUndefined();
        expect(layoutOverrideOf(undefined)).toBeUndefined();
        expect(layoutOverrideOf("tablet")).toBeUndefined();
    });
});

describe("what a reload would switch to", () => {
    // a desktop browser loaded at `width` in a build with the new web UI and the old mobile UI
    function loaded(width: number, overrides: Partial<LayoutInputs> = {}) {
        const startInputs = inputs({
            mobileLayoutFlag: "v2",
            webLayoutFlag: "v3",
            width,
            ...overrides,
        });
        return { layout: selectLayout(startInputs), inputs: startInputs };
    }

    test("the web UI narrowed below 768px: the phone layout", () => {
        const web = loaded(1400);
        expect(web.layout).toBe("v3");
        expect(layoutSwitchAt(web, 767)).toBe("phone");
        expect(layoutSwitchAt(web, 600)).toBe("phone");
    });

    test("the web UI at 768px or more: nothing", () => {
        const web = loaded(1400);
        for (const width of [768, 820, 1000, 2000]) {
            expect(layoutSwitchAt(web, width), `${width}`).toBeUndefined();
        }
        // loaded below the shell's minimum width, which scrolls sideways
        expect(layoutSwitchAt(loaded(820), 1400)).toBeUndefined();
    });

    test("the old mobile UI widened to 768px or more: the desktop layout", () => {
        const mobile = loaded(600);
        expect(mobile.layout).toBe("v2");
        expect(layoutSwitchAt(mobile, 767)).toBeUndefined();
        expect(layoutSwitchAt(mobile, 768)).toBe("desktop");
        expect(layoutSwitchAt(mobile, 1400)).toBe("desktop");
    });

    test("the old desktop UI on a narrow window, where a build has no v2: the desktop layout", () => {
        const narrow = loaded(600, { mobileLayoutFlag: "v1" });
        expect(narrow.layout).toBe("v1");
        expect(layoutSwitchAt(narrow, 1400)).toBe("desktop");
        expect(layoutSwitchAt(narrow, 700)).toBeUndefined();
    });

    test("never between the old trees, in a build without the new ones", () => {
        const old = (width: number) => loaded(width, { webLayoutFlag: undefined });
        expect(old(1400).layout).toBe("v1");
        expect(layoutSwitchAt(old(1400), 600)).toBeUndefined();
        expect(layoutSwitchAt(old(600), 1400)).toBeUndefined();
    });

    test("never in the native apps", () => {
        const app = (width: number, flags: Partial<LayoutInputs> = {}) =>
            loaded(width, { nativeApp: true, ...flags });
        expect(layoutSwitchAt(app(600), 1400)).toBeUndefined();
        expect(layoutSwitchAt(app(1400), 600)).toBeUndefined();
        expect(layoutSwitchAt(app(600, { nativeLayoutFlag: "v4" }), 1400)).toBeUndefined();
    });

    test("with the native tree: by width, and by orientation on a tablet", () => {
        const native = { nativeLayoutFlag: "v4" };
        expect(layoutSwitchAt(loaded(1400, native), 600)).toBe("phone");
        expect(layoutSwitchAt(loaded(600, native), 1400)).toBe("desktop");
        const tablet = { ...native, coarsePointer: true, canHover: false };
        expect(layoutSwitchAt(loaded(1180, tablet), 820)).toBe("phone");
        expect(layoutSwitchAt(loaded(820, tablet), 1180)).toBe("desktop");
    });
});
