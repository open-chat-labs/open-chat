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

        test("undefined fields are removed from array values", () => {
            const value = [1, true, { a: null, b: 2 }, { c: undefined }];
            const expected = [1, true, { b: 2 }, { }];
            expect(deepRemoveNullishFields(value)).toEqual(expected);
        });

        test("non-objects are untouched", () => {
            expect(deepRemoveNullishFields(1000)).toEqual(1000);
            expect(deepRemoveNullishFields("a")).toEqual("a");
            expect(deepRemoveNullishFields(true)).toEqual(true);
            expect(deepRemoveNullishFields(null)).toEqual(null);
        });
    });
});
