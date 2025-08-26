import { SafeMap } from "./map";

describe("safe map from entries", () => {
    test("simple map", () => {
        const map = new Map<string, string>([["hello", "world"]]);
        const safeMap = SafeMap.fromEntries(map.entries());
        expect(safeMap.get("hello")).toEqual("world");
    });
});
