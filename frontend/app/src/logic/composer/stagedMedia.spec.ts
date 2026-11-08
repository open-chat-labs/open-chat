import type { AttachmentContent, MessageContext, SendMessageOutcome } from "@client";
import { isMedia, mediaCount, sendMoreMedia, stageMedia, unstage } from "./stagedMedia";

const image = (n: number): AttachmentContent => ({
    kind: "image_content",
    height: 1,
    width: 1,
    thumbnailData: `thumb${n}`,
    mimeType: "image/jpeg",
    blobUrl: `blob:${n}`,
});

const file: AttachmentContent = {
    kind: "file_content",
    name: "notes.pdf",
    mimeType: "application/pdf",
    fileSize: 10,
};

describe("photos and videos attached together", () => {
    test("the first is the draft's, the others follow", () => {
        const staged = stageMedia({ first: undefined, more: [] }, [image(1), image(2), image(3)]);
        expect(staged).toEqual({ first: image(1), more: [image(2), image(3)] });
        expect(mediaCount(staged)).toBe(3);
    });

    test("more are added after those there", () => {
        const staged = stageMedia({ first: image(1), more: [image(2)] }, [image(3)]);
        expect(staged).toEqual({ first: image(1), more: [image(2), image(3)] });
    });

    test("take a file's place: media and files don't mix", () => {
        const staged = stageMedia({ first: file, more: [] }, [image(1), image(2)]);
        expect(staged).toEqual({ first: image(1), more: [image(2)] });
        expect(isMedia(file)).toBe(false);
        expect(mediaCount({ first: file, more: [] })).toBe(0);
    });

    test("are ten at most", () => {
        const many = Array.from({ length: 12 }, (_, i) => image(i));
        expect(mediaCount(stageMedia({ first: undefined, more: [] }, many))).toBe(10);
        expect(mediaCount(stageMedia({ first: image(0), more: many.slice(1, 9) }, many))).toBe(10);
    });

    test("one removed, the next takes its place", () => {
        const staged = { first: image(1), more: [image(2), image(3)] };
        expect(unstage(staged, 0)).toEqual({ first: image(2), more: [image(3)] });
        expect(unstage(staged, 2)).toEqual({ first: image(1), more: [image(2)] });
        expect(unstage({ first: image(1), more: [] }, 0)).toEqual({ first: undefined, more: [] });
    });
});

describe("sending the photos and videos after the draft's", () => {
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
