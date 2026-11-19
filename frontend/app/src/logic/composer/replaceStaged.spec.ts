import type { MessageContext } from "@client";
import { describe, expect, test } from "vitest";
import en from "@src/i18n/en.json";
import {
    fileAttachStep,
    incomingBuilder,
    incomingFile,
    replaceNeedsConfirm,
    replaceQuestionText,
    stagedBuilder,
    type IncomingAttachment,
    type StagedBuilder,
} from "./replaceStaged";

const prize = { kind: "prize_content_initial" };
const transfer = { kind: "crypto_content" };
const swap = { kind: "p2p_swap_content_initial" };
const image = { kind: "image_content" };
const video = { kind: "video_content" };
const file = { kind: "file_content" };
const gif = { kind: "giphy_content" };

const everyIncoming: IncomingAttachment[] = [
    "photo",
    "video",
    "file",
    "gif",
    "prize",
    "transfer",
    "swap",
];

describe("stagedBuilder", () => {
    test("a prize, a transfer and a swap offer are a builder's", () => {
        expect(stagedBuilder(prize)).toBe("prize");
        expect(stagedBuilder(transfer)).toBe("transfer");
        expect(stagedBuilder(swap)).toBe("swap");
    });

    test("a photo, video, file or GIF isn't, nor nothing", () => {
        for (const content of [image, video, file, gif, undefined]) {
            expect(stagedBuilder(content)).toBeUndefined();
        }
    });
});

describe("replaceNeedsConfirm", () => {
    test("anything replacing a builder's content asks, naming both", () => {
        for (const [content, staged] of [
            [prize, "prize"],
            [transfer, "transfer"],
            [swap, "swap"],
        ] as const) {
            for (const incoming of everyIncoming) {
                expect(replaceNeedsConfirm(content, incoming)).toEqual({ staged, incoming });
            }
        }
    });

    test("a photo, video, file or GIF is replaced without asking, by anything", () => {
        for (const content of [image, video, file, gif]) {
            for (const incoming of everyIncoming) {
                expect(replaceNeedsConfirm(content, incoming)).toBeUndefined();
            }
        }
    });

    test("nothing staged, nothing to ask", () => {
        expect(replaceNeedsConfirm(undefined, "gif")).toBeUndefined();
        expect(replaceNeedsConfirm(undefined, "prize")).toBeUndefined();
    });
});

describe("incomingFile", () => {
    test("from the file's type", () => {
        expect(incomingFile("image/png")).toBe("photo");
        expect(incomingFile("image/gif")).toBe("photo");
        expect(incomingFile("video/mp4")).toBe("video");
        expect(incomingFile("application/pdf")).toBe("file");
        expect(incomingFile("audio/mpeg")).toBe("file");
        expect(incomingFile("")).toBe("file");
    });
});

describe("incomingBuilder", () => {
    test("the builders that attach to the draft", () => {
        expect(incomingBuilder("prize")).toBe("prize");
        expect(incomingBuilder("crypto")).toBe("transfer");
        expect(incomingBuilder("swap")).toBe("swap");
    });

    test("a poll and a meme are sent as they're made, replacing nothing", () => {
        expect(incomingBuilder("poll")).toBeUndefined();
        expect(incomingBuilder("memeFighter")).toBeUndefined();
    });
});

describe("fileAttachStep", () => {
    const chat: MessageContext = { chatId: { kind: "group_chat", groupId: "g" } };
    const thread: MessageContext = { ...chat, threadRootMessageIndex: 3 };

    // a chat that takes only what `allowed` names, where `mode` says
    function client(allowed: string[], seen: unknown[] = []) {
        return {
            canSendMessage: (
                chatId: MessageContext["chatId"],
                mode: string,
                permission?: string,
            ) => {
                seen.push([chatId, mode, permission]);
                return permission !== undefined && allowed.includes(permission);
            },
        };
    }

    test("a file the chat doesn't take is refused without asking, whatever's staged", () => {
        expect(fileAttachStep(client(["image"]), chat, "video/mp4", prize)).toEqual({
            kind: "refused",
            refusal: { kind: "not_permitted", permission: "video" },
        });
        expect(fileAttachStep(client([]), chat, "application/pdf", undefined)).toEqual({
            kind: "refused",
            refusal: { kind: "not_permitted", permission: "file" },
        });
    });

    test("one it takes asks in place of a builder's content", () => {
        expect(fileAttachStep(client(["image"]), chat, "image/png", swap)).toEqual({
            kind: "confirm",
            question: { staged: "swap", incoming: "photo" },
        });
    });

    test("one it takes is attached in place of anything else, or nothing", () => {
        expect(fileAttachStep(client(["video"]), chat, "video/mp4", image)).toEqual({
            kind: "attach",
        });
        expect(fileAttachStep(client(["file"]), chat, "text/plain", undefined)).toEqual({
            kind: "attach",
        });
    });

    test("checked where it's going: the chat, or the thread", () => {
        const seen: unknown[] = [];
        fileAttachStep(client(["image"], seen), chat, "image/png", undefined);
        fileAttachStep(client(["image"], seen), thread, "audio/mpeg", undefined);
        expect(seen).toEqual([
            [chat.chatId, "message", "image"],
            [chat.chatId, "thread", "audio"],
        ]);
    });
});

describe("replaceQuestionText", () => {
    test("every question's words are in the English copy", () => {
        const replace = en.builders.replace;
        const staged: StagedBuilder[] = ["prize", "transfer", "swap"];
        for (const s of staged) {
            for (const incoming of everyIncoming) {
                const text = replaceQuestionText({ staged: s, incoming });
                expect(text.title.key).toBe(`builders.replace.title.${s}`);
                expect(text.message.key).toBe(`builders.replace.with.${incoming}`);
                expect(replace.title[s]).toBeTypeOf("string");
                expect(replace.with[incoming]).toBeTypeOf("string");
            }
        }
    });
});
