import { scaleToFit } from "./media";

describe("scaleToFit", () => {
    test("returns the original dimensions when already within bounds", () => {
        expect(scaleToFit({ width: 640, height: 480 }, { width: 1500, height: 1500 })).toEqual({
            width: 640,
            height: 480,
        });
    });

    test("scales landscape dimensions to the max width", () => {
        expect(scaleToFit({ width: 2000, height: 1000 }, { width: 1500, height: 1500 })).toEqual({
            width: 1500,
            height: 750,
        });
    });

    test("scales portrait dimensions to the max height", () => {
        expect(scaleToFit({ width: 1000, height: 2000 }, { width: 1500, height: 1500 })).toEqual({
            width: 750,
            height: 1500,
        });
    });

    test("floors the scaled dimensions", () => {
        expect(scaleToFit({ width: 1000, height: 333 }, { width: 100, height: 100 })).toEqual({
            width: 100,
            height: 33,
        });
    });
});
