import { deepRemoveNullishFields } from "./nullish";

describe("nullish utils", () => {
    describe("deepRemoveNullishFields", () => {
        test("undefined fields are removed", () => {
            const value = {
                a: 1,
                b: 2,
                c: null,
                d: undefined,
                e: [],
            };
            const expected = {
                a: 1,
                b: 2,
                e: [],
            };
            expect(deepRemoveNullishFields(value)).toEqual(expected);
        });

        test("nested undefined fields are removed", () => {
            const value = {
                a: {
                    b: 2,
                    c: null,
                    d: undefined,
                    e: [],
                }
            };
            const expected = {
                a: {
                    b: 2,
                    e: [],
                }
            };
            expect(deepRemoveNullishFields(value)).toEqual(expected);
        });

        test("nullish fields are removed from objects in arrays", () => {
            const value = [1, true, { a: null, b: 2 }, { c: undefined }];
            const expected = [1, true, { b: 2 }, { }];
            expect(deepRemoveNullishFields(value)).toStrictEqual(expected);
        });

        test("null values in arrays are untouched", () => {
            const value = [null, 1, true];
            const expected = [null, 1, true];
            expect(deepRemoveNullishFields(value)).toStrictEqual(expected);
        });

        test("non-objects are untouched", () => {
            expect(deepRemoveNullishFields(1000)).toStrictEqual(1000);
            expect(deepRemoveNullishFields("a")).toStrictEqual("a");
            expect(deepRemoveNullishFields(true)).toStrictEqual(true);
            expect(deepRemoveNullishFields(null)).toStrictEqual(null);
        });
    });
});
