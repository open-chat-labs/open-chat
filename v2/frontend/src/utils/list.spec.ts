import { groupWhile } from "./list";

describe("list utils", () => {
    describe("group by", () => {
        test("everything ends up in one group", () => {
            const grouped = groupWhile((a: number, b: number) => a === b, [1, 1, 1, 1, 1, 1, 1]);
            expect(grouped.length).toEqual(1);
            expect(grouped[0]).toEqual([1, 1, 1, 1, 1, 1, 1]);
        });

        test("two groups", () => {
            const grouped = groupWhile((a: number, b: number) => a === b, [1, 1, 1, 2, 2, 2, 2]);
            expect(grouped.length).toEqual(2);
            expect(grouped[0]).toEqual([1, 1, 1]);
            expect(grouped[1]).toEqual([2, 2, 2, 2]);
        });

        test("only singleton groups", () => {
            const grouped = groupWhile((a: number, b: number) => a === b, [1, 2, 3, 4, 5, 6]);
            expect(grouped.length).toEqual(6);
            expect(grouped[0]).toEqual([1]);
            expect(grouped[1]).toEqual([2]);
            expect(grouped[2]).toEqual([3]);
            expect(grouped[3]).toEqual([4]);
            expect(grouped[4]).toEqual([5]);
            expect(grouped[5]).toEqual([6]);
        });

        test("empty list", () => {
            const grouped = groupWhile((a: number, b: number) => a === b, []);
            expect(grouped.length).toEqual(0);
        });
    });
});
