import { chunk, dedupe, flatMap, groupWhile } from "./list";

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

    describe("flatMap", () => {
        test("it works", () => {
            const xs = [
                {
                    a: [1, 2, 3],
                },
                {
                    a: [4, 5, 6],
                },
                {
                    a: [7, 8, 9],
                },
            ];

            const flat = flatMap(xs, (x) => x.a);

            expect(flat).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });
    });

    describe("dedupe", () => {
        const things = [
            {
                a: 1,
            },
            {
                a: 1,
            },
            {
                a: 2,
            },
            {
                a: 2,
            },
            {
                a: 3,
            },
            {
                a: 3,
            },
        ];

        const deduped = dedupe((a, b) => a.a === b.a, things);
        expect(deduped.length).toEqual(3);
        expect(deduped[0].a).toEqual(1);
        expect(deduped[1].a).toEqual(2);
        expect(deduped[2].a).toEqual(3);
    });

    describe("chunk", () => {
        const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        expect(chunk(array, 2)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9]]);
        expect(chunk(array, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    });
});
