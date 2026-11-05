import {
    attachFailureMessage,
    DIAMOND_MAX_SIZES,
    filePermission,
    FREE_MAX_SIZES,
    maxMediaSizes,
    scaleToFit,
} from "./media";

describe("the permission a file needs", () => {
    test("is the kind its type makes it", () => {
        expect(filePermission("image/jpeg")).toBe("image");
        expect(filePermission("image/gif")).toBe("image");
        expect(filePermission("image/svg+xml")).toBe("image");
        expect(filePermission("video/mp4")).toBe("video");
        expect(filePermission("audio/mpeg")).toBe("audio");
        expect(filePermission("application/pdf")).toBe("file");
        expect(filePermission("")).toBe("file");
    });
});

describe("the media size limits", () => {
    test("are a Diamond member's or everyone else's", () => {
        expect(maxMediaSizes(true)).toBe(DIAMOND_MAX_SIZES);
        expect(maxMediaSizes(false)).toBe(FREE_MAX_SIZES);
    });
});

describe("attachFailureMessage", () => {
    test("names the size limit a file is over", () => {
        expect(attachFailureMessage("maxVideoSize").key).toBe("maxVideoSize");
        expect(attachFailureMessage("maxAudioSize").key).toBe("maxAudioSize");
        expect(attachFailureMessage("maxFileSize").key).toBe("maxFileSize");
    });

    test("anything else is a file that couldn't be attached", () => {
        expect(attachFailureMessage(new Error("failed to load video")).key).toBe(
            "attachFileFailed",
        );
        expect(attachFailureMessage("something else").key).toBe("attachFileFailed");
        expect(attachFailureMessage(undefined).key).toBe("attachFileFailed");
    });
});

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
