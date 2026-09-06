import { selectLayout } from "./layout";

describe("selectLayout", () => {
    test("v2 flag on a narrow viewport selects the mobile app", () => {
        expect(selectLayout("v2", true)).toBe("v2");
    });
    test("v2 flag on a wide viewport selects the desktop app", () => {
        expect(selectLayout("v2", false)).toBe("v1");
    });
    test("v1 flag always selects the desktop app", () => {
        expect(selectLayout("v1", true)).toBe("v1");
        expect(selectLayout("v1", false)).toBe("v1");
    });
    test("missing flag selects the desktop app", () => {
        expect(selectLayout(undefined, true)).toBe("v1");
    });
});
