import { MAX_MEDIA, MediaSelection } from "./mediaSelection.svelte";

const photo = (id: string) => ({ id, video: false });
const video = (id: string) => ({ id, video: true });

describe("picking photos and videos to attach", () => {
    test("numbers them in the order they're picked", () => {
        const selection = new MediaSelection();
        expect(selection.toggle(photo("a"))).toBe("picked");
        expect(selection.toggle(video("b"))).toBe("picked");
        expect(selection.numberOf("a")).toBe(1);
        expect(selection.numberOf("b")).toBe(2);
        expect(selection.numberOf("c")).toBeUndefined();
        expect(selection.counts).toEqual({ photos: 1, videos: 1 });
    });

    test("a second tap puts one back, and those after it move up", () => {
        const selection = new MediaSelection();
        selection.toggle(photo("a"));
        selection.toggle(photo("b"));
        selection.toggle(photo("c"));
        expect(selection.toggle(photo("a"))).toBe("unpicked");
        expect(selection.numberOf("b")).toBe(1);
        expect(selection.numberOf("c")).toBe(2);
        expect(selection.count).toBe(2);
    });

    test("takes up to ten, the eleventh refused", () => {
        const selection = new MediaSelection();
        for (let i = 0; i < MAX_MEDIA; i++) expect(selection.toggle(photo(`${i}`))).toBe("picked");
        expect(selection.toggle(photo("eleventh"))).toBe("full");
        expect(selection.count).toBe(MAX_MEDIA);
        // one put back makes room again
        selection.toggle(photo("3"));
        expect(selection.toggle(photo("eleventh"))).toBe("picked");
    });

    test("takes fewer when some are attached already", () => {
        const selection = new MediaSelection(2);
        selection.toggle(photo("a"));
        selection.toggle(photo("b"));
        expect(selection.toggle(photo("c"))).toBe("full");
        selection.max = 3;
        expect(selection.toggle(photo("c"))).toBe("picked");
    });

    test("clears", () => {
        const selection = new MediaSelection();
        selection.toggle(photo("a"));
        selection.clear();
        expect(selection.count).toBe(0);
        expect(selection.picked).toEqual([]);
    });
});
