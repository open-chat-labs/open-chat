import { selectLayout } from "./layout";

describe("selectLayout", () => {
    test("v2 flag on a narrow viewport selects the mobile app", () => {
        expect(selectLayout("v2", undefined, true, false)).toBe("v2");
    });
    test("v2 flag on a wide viewport selects the desktop app", () => {
        expect(selectLayout("v2", undefined, false, false)).toBe("v1");
    });
    test("v1 flag always selects the desktop app", () => {
        expect(selectLayout("v1", undefined, true, false)).toBe("v1");
        expect(selectLayout("v1", undefined, false, false)).toBe("v1");
    });
    test("missing flags select the desktop app", () => {
        expect(selectLayout(undefined, undefined, true, false)).toBe("v1");
        expect(selectLayout(undefined, undefined, false, false)).toBe("v1");
    });
    test("v3 web flag on a wide viewport selects the new web app", () => {
        expect(selectLayout(undefined, "v3", false, false)).toBe("v3");
        expect(selectLayout("v2", "v3", false, false)).toBe("v3");
    });
    test("v3 web flag on a narrow viewport keeps the existing apps", () => {
        expect(selectLayout(undefined, "v3", true, false)).toBe("v1");
        expect(selectLayout("v2", "v3", true, false)).toBe("v2");
    });
    test("v3 web flag in a native app keeps the existing apps", () => {
        expect(selectLayout(undefined, "v3", false, true)).toBe("v1");
        expect(selectLayout("v2", "v3", false, true)).toBe("v1");
        expect(selectLayout("v2", "v3", true, true)).toBe("v2");
    });
    test("any other web flag value is ignored", () => {
        expect(selectLayout(undefined, "v4", false, false)).toBe("v1");
    });
});
