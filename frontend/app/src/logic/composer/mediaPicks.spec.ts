import type { AttachmentContent, MessageContext, SendMessageOutcome } from "@client";
import { leftMedia, MAX_MEDIA, MediaPicks, picksTray, sendMoreMedia } from "./mediaPicks.svelte";

const photo = (id: string) => ({ id, video: false, thumb: `data:${id}` });
const video = (id: string) => ({ id, video: true, thumb: `data:${id}`, duration: "0:14" });

const image = (n: number): AttachmentContent => ({
    kind: "image_content",
    height: 1,
    width: 1,
    thumbnailData: `thumb${n}`,
    mimeType: "image/jpeg",
    blobUrl: `blob:${n}`,
});

describe("the photos and videos picked for a message", () => {
    test("are numbered in the order they're picked", () => {
        const picks = new MediaPicks();
        expect(picks.toggle(photo("a"))).toBe("picked");
        expect(picks.toggle(video("b"))).toBe("picked");
        expect(picks.numberOf("a")).toBe(1);
        expect(picks.numberOf("b")).toBe(2);
        expect(picks.numberOf("c")).toBeUndefined();
    });

    test("a second tap puts one back, and those after it move up", () => {
        const picks = new MediaPicks();
        ["a", "b", "c"].forEach((id) => picks.toggle(photo(id)));
        expect(picks.toggle(photo("a"))).toBe("unpicked");
        expect(picks.numberOf("b")).toBe(1);
        expect(picks.numberOf("c")).toBe(2);
    });

    test("are the composer's: a thumbnail removed there is put back in the panel", () => {
        const picks = new MediaPicks();
        ["a", "b", "c"].forEach((id) => picks.toggle(photo(id)));
        picks.removeAt(1);
        expect(picks.numberOf("b")).toBeUndefined();
        expect(picks.numberOf("c")).toBe(2);
        picks.clear();
        expect(picks.count).toBe(0);
    });

    test("take up to ten, the eleventh refused", () => {
        const picks = new MediaPicks();
        for (let i = 0; i < MAX_MEDIA; i++) expect(picks.toggle(photo(`${i}`))).toBe("picked");
        expect(picks.toggle(photo("eleventh"))).toBe("full");
        expect(picks.add(photo("camera"))).toBe("full");
        expect(picks.room).toBe(0);
        picks.toggle(photo("3"));
        expect(picks.toggle(photo("eleventh"))).toBe("picked");
    });

    test("take their content once it's prepared, unless put back meanwhile", async () => {
        const picks = new MediaPicks();
        picks.toggle(photo("a"));
        picks.toggle(photo("b"));
        picks.prepared("b", image(2));
        expect((await picks.take(["a", "b"])).contents).toEqual([image(2)]);
        picks.prepared("a", image(1));
        expect(await picks.take(["a", "b"])).toEqual({ ids: ["a", "b"], contents: [image(1), image(2)] });
        picks.remove("a");
        picks.prepared("a", image(1));
        expect((await picks.take(["a", "b"])).contents).toEqual([image(2)]);
    });

    test("a send waits for those it took to be prepared, not those picked meanwhile", async () => {
        const picks = new MediaPicks();
        picks.toggle(photo("a"));
        picks.toggle(video("b"));
        picks.prepared("a", image(1));
        let prepareB: () => void = () => {};
        picks.preparing("b", new Promise<void>((resolve) => (prepareB = resolve)));
        const ids = picks.ids();
        const sending = picks.take(ids);
        // picked after Send, while the video's still being prepared
        picks.toggle(photo("c"));
        picks.preparing("c", new Promise<void>(() => {}));
        picks.prepared("b", image(2));
        prepareB();
        expect(await sending).toEqual({ ids: ["a", "b"], contents: [image(1), image(2)] });
        picks.removeAll(ids);
        expect(picks.ids()).toEqual(["c"]);
    });

    test("a send waits for one put back and picked again while it waits, prepared afresh", async () => {
        const picks = new MediaPicks();
        picks.toggle(photo("a"));
        let prepareFirst: () => void = () => {};
        picks.preparing("a", new Promise<void>((resolve) => (prepareFirst = resolve)));
        const sending = picks.take(picks.ids());
        // a Recents tile tapped off and on again: a new job for the same id
        picks.toggle(photo("a"));
        picks.toggle(photo("a"));
        let prepareAgain: () => void = () => {};
        picks.preparing("a", new Promise<void>((resolve) => (prepareAgain = resolve)));
        prepareFirst();
        // the first job long settled, the send still waits for the second
        await new Promise((resolve) => setTimeout(resolve, 0));
        picks.prepared("a", image(1));
        prepareAgain();
        expect(await sending).toEqual({ ids: ["a"], contents: [image(1)] });
    });

    test("a send takes out only the picks it sent", async () => {
        const picks = new MediaPicks();
        picks.toggle(photo("a"));
        picks.toggle(photo("b"));
        picks.prepared("a", image(1));
        const taken = await picks.take(picks.ids());
        expect(taken).toEqual({ ids: ["a"], contents: [image(1)] });
        picks.removeAll(taken.ids);
        expect(picks.ids()).toEqual(["b"]);
    });

    test("a send whose picks all failed to be prepared has nothing to send", async () => {
        const picks = new MediaPicks();
        picks.toggle(photo("a"));
        picks.preparing(
            "a",
            Promise.reject(new Error("unreadable")).finally(() => picks.remove("a")),
        );
        expect(await picks.take(picks.ids())).toEqual({ ids: [], contents: [] });
        expect(picks.count).toBe(0);
    });

    test("let go of the thumbnails they made as each goes, and make none for one refused", () => {
        const revoke = vi.fn();
        const picks = new MediaPicks(revoke);
        let made = 0;
        const thumb = () => `blob:${made++}`;
        picks.add({ id: "a", video: false }, thumb);
        picks.add({ id: "b", video: false }, thumb);
        picks.add({ id: "c", video: false }, thumb);
        picks.toggle(photo("d"));
        expect(picks.picks.map((p) => p.thumb)).toEqual(["blob:0", "blob:1", "blob:2", "data:d"]);
        picks.remove("a");
        picks.removeAt(0);
        expect(revoke.mock.calls).toEqual([["blob:0"], ["blob:1"]]);
        picks.clear();
        expect(revoke.mock.calls).toEqual([["blob:0"], ["blob:1"], ["blob:2"]]);

        for (let i = 0; i < MAX_MEDIA; i++) picks.toggle(photo(`${i}`));
        expect(picks.add({ id: "e", video: false }, thumb)).toBe("full");
        expect(made).toBe(3);
    });

    test("let go of the thumbnails still in when the composer goes", () => {
        const revoke = vi.fn();
        const picks = new MediaPicks(revoke);
        picks.add({ id: "a", video: false }, () => "blob:a");
        picks.dispose();
        expect(revoke).toHaveBeenCalledWith("blob:a");
    });

    test("show in the composer's tray as their thumbnails, a video with its length", () => {
        const picks = new MediaPicks();
        picks.toggle(photo("a"));
        picks.toggle(video("b"));
        expect(picksTray(picks.picks)).toEqual({
            type: "media",
            items: [
                { kind: "image", src: "data:a" },
                { kind: "video", bg: 'center/cover no-repeat url("data:b")', dur: "0:14" },
            ],
        });
    });
});

describe("sending the photos and videos after the first", () => {
    const context: MessageContext = { chatId: { kind: "group_chat", groupId: "g" } };

    test("sends each in its own message, in order", async () => {
        const sendContent = vi.fn(async (): Promise<SendMessageOutcome> => ({ kind: "posted" }));
        expect(await sendMoreMedia({ sendContent }, context, [image(2), image(3)])).toEqual({
            kind: "posted",
        });
        expect(sendContent.mock.calls).toEqual([
            [context, image(2)],
            [context, image(3)],
        ]);
    });

    test("refused, stops, leaving those not sent", async () => {
        const outcomes: SendMessageOutcome[] = [{ kind: "posted" }, { kind: "throttled" }];
        const sendContent = vi.fn(async () => outcomes.shift() ?? { kind: "posted" as const });
        expect(
            await sendMoreMedia({ sendContent }, context, [image(2), image(3), image(4)]),
        ).toEqual({ kind: "refused", reason: "throttled", left: [image(3), image(4)] });
        expect(sendContent).toHaveBeenCalledTimes(2);
    });
});

describe("the photos and videos a send left", () => {
    test("are picked again ahead of those picked since, with their content", async () => {
        const picks = new MediaPicks();
        picks.toggle(photo("new"));
        expect(picks.restore([leftMedia("l1", image(2)), leftMedia("l2", image(3))])).toBe(0);
        expect(picks.ids()).toEqual(["l1", "l2", "new"]);
        expect((await picks.take(["l1", "l2"])).contents).toEqual([image(2), image(3)]);
    });

    test("as many as there's room for, saying how many there wasn't", () => {
        const picks = new MediaPicks();
        for (let i = 0; i < MAX_MEDIA - 1; i++) picks.toggle(photo(`${i}`));
        const left = [1, 2, 3].map((n) => leftMedia(`l${n}`, image(n)));
        expect(picks.restore(left)).toBe(2);
        expect(picks.ids()[0]).toBe("l1");
        expect(picks.count).toBe(MAX_MEDIA);
    });

    test("show as their content: a photo itself, a video its thumbnail", () => {
        expect(leftMedia("l", image(2))).toEqual({
            id: "l",
            video: false,
            thumb: "blob:2",
            content: image(2),
        });
        const clip: AttachmentContent = {
            kind: "video_content",
            height: 1,
            width: 1,
            thumbnailData: "thumb",
            mimeType: "video/mp4",
            imageData: {},
            videoData: {},
        };
        expect(leftMedia("v", clip)).toMatchObject({ video: true, thumb: "thumb" });
    });
});
