import { indexIsInRanges } from "./range";
import DRange from "drange";

describe("index is in ranges", () => {
    test("where index is not in ranges", () => {
        expect(indexIsInRanges(15, new DRange(11, 13))).toEqual(false);
    });
    test("where index is in ranges", () => {
        expect(indexIsInRanges(15, new DRange(11, 13).add(15, 20))).toEqual(true);
    });
    test("where there are no ranges", () => {
        expect(indexIsInRanges(15, new DRange())).toEqual(false);
    });
});
