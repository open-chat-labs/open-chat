import type { AttachmentContent, MessageContent, MessageContext } from "@client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileFunction } from "node:vm";
import { ScriptTarget, transpileModule } from "typescript";
import type { runLocalAiCommand } from "./localAiCommand";
import { afterEach, describe, expect, it, vi } from "vitest";

// Exercise the real generic readers and orchestration without loading model weights.
vi.mock("./onDeviceInference", () => ({
    inferOnDevice: vi.fn(),
    onDeviceInferenceCapability: () => ({
        available: true,
        runtimesSupported: ["transformers-webgpu"],
        selectedModalities: ["text", "image", "audio"],
    }),
}));

import {
    captureLocalAiComposerContext,
    createLocalAiComposerRunner,
    localAiComposerContextIsCurrent,
    type LocalAiComposerRequest,
} from "./localAiComposer";

const CHAT_A = {
    chatId: { kind: "direct_chat", userId: "chat-a" },
    threadRootMessageIndex: 9,
} as MessageContext;
const CHAT_B = {
    chatId: { kind: "direct_chat", userId: "chat-b" },
} as MessageContext;

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

function request(
    client: {
        downloadPublicBlob: ReturnType<typeof vi.fn>;
        sendMessageWithContent: ReturnType<typeof vi.fn>;
    },
    overrides: Partial<LocalAiComposerRequest> = {},
): LocalAiComposerRequest {
    const captured = captureLocalAiComposerContext("viewer-a", CHAT_A);
    return {
        client: client as never,
        prompt: "summarize this chat",
        context: [
            { author: "Mickey", text: "The meeting starts at noon" },
            { author: "Alex", text: "Bring the draft" },
        ],
        captured,
        stillCurrent: () => true,
        onAccepted: vi.fn(),
        ...overrides,
    };
}

function client(sendResult: { kind: string } = { kind: "success" }) {
    return {
        downloadPublicBlob: vi.fn(),
        sendMessageWithContent: vi.fn(async () => sendResult),
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function voice(extra: Record<string, unknown> = {}): AttachmentContent {
    return {
        kind: "audio_content",
        mimeType: "audio/webm;codecs=opus",
        samples: new Uint8Array([1]),
        durationMs: 2_000n,
        caption: "Selected voice",
        ...extra,
    } as AttachmentContent;
}

describe("generic /ai voice invocation in both UIs", () => {
    it.each([
        ["components", "staged"],
        ["components", "reply"],
        ["components_mobile", "staged"],
        ["components_mobile", "reply"],
    ])(
        "executes the actual %s handler with a %s voice and the real runner",
        async (tree, selection) => {
            const source = readFileSync(
                resolve(process.cwd(), `app/src/${tree}/home/MessageEntry.svelte`),
                "utf8",
            );
            const start = source.indexOf("    async function handleLocalAiCommand(");
            const end = source.indexOf("\n    function afterSendMessage", start);
            expect(start).toBeGreaterThan(0);
            expect(end).toBeGreaterThan(start);
            const handler = transpileModule(source.slice(start, end), {
                compilerOptions: { target: ScriptTarget.ES2022 },
            }).outputText;
            // Execute the component's actual handler, not a reimplementation. Simulate the normal
            // synchronous send clearing both media props, as the Svelte parent does.
            const execute = compileFunction(
                `const onSendMessage = (args) => {
                onAccepted(args);
                attachment = undefined;
                replyingTo = undefined;
            };
            ${handler}
            return handleLocalAiCommand(prompt);`,
                [
                    "prompt",
                    "attachment",
                    "replyingTo",
                    "containsMarkdown",
                    "$currentUserIdStore",
                    "messageContext",
                    "componentMounted",
                    "localAiComposer",
                    "client",
                    "captureLocalAiComposerContext",
                    "localAiComposerContextIsCurrent",
                    "onAccepted",
                    "toastStore",
                    "i18nKey",
                ],
            );
            const bytes = new Uint8Array([21, 22]);
            const selectedVoice = voice({ blobData: bytes });
            const api = client();
            const infer = vi.fn<typeof runLocalAiCommand>(async () => ({
                kind: "ok",
                reply: "transcript",
            }));
            const accepted = vi.fn();
            const showFailureToast = vi.fn();
            await execute(
                "transcribe this",
                selection === "staged" ? selectedVoice : undefined,
                selection === "reply" ? { content: selectedVoice } : undefined,
                false,
                "viewer-a",
                CHAT_A,
                true,
                createLocalAiComposerRunner({ infer }),
                api,
                captureLocalAiComposerContext,
                localAiComposerContextIsCurrent,
                accepted,
                { showFailureToast },
                (key: string) => key,
            );
            expect(accepted).toHaveBeenCalledExactlyOnceWith(["transcribe this", [], false]);
            expect(infer).toHaveBeenCalledWith(
                "transcribe this",
                undefined,
                expect.any(Array),
                bytes,
                "audio/webm;codecs=opus",
            );
            expect(api.sendMessageWithContent).toHaveBeenCalledWith(
                CHAT_A,
                { kind: "text_content", text: "🤖 transcript" },
                true,
                [],
                false,
            );
            expect(showFailureToast).not.toHaveBeenCalled();
        },
    );

    it.each(["components", "components_mobile"])(
        "%s routes staged and replied media through the guarded runner",
        (tree) => {
            const source = readFileSync(
                resolve(process.cwd(), `app/src/${tree}/home/MessageEntry.svelte`),
                "utf8",
            );
            expect(source).toContain("createLocalAiComposerRunner()");
            expect(source).toContain("const capturedAttachment = attachment;");
            expect(source).toContain("const capturedReply = replyingTo?.content;");
            expect(source).toContain("attachment: capturedAttachment");
            expect(source).toContain("repliedContent: capturedReply");
            expect(source).toContain(
                "localAiComposerContextIsCurrent(captured, $currentUserIdStore, messageContext)",
            );
            expect(source).toContain("componentMounted = false");
            expect(source).toContain("if (localAiComposer.running)");
            expect(source).not.toContain("aiActionRunner");
        },
    );

    it.each(["staged", "reply"] as const)(
        "routes an explicit %s voice through the real reader",
        async (selected) => {
            const bytes = new Uint8Array([1, 2, 3]);
            const content = voice({ blobData: bytes });
            const api = client();
            const infer = vi.fn<typeof runLocalAiCommand>(
                async () => ({ kind: "ok", reply: "transcript" }) as const,
            );
            const runner = createLocalAiComposerRunner({ infer });
            await expect(
                runner.run(
                    request(
                        api,
                        selected === "staged"
                            ? { attachment: content }
                            : { repliedContent: content },
                    ),
                ),
            ).resolves.toEqual({ kind: "sent" });
            expect(infer).toHaveBeenCalledWith(
                "summarize this chat",
                undefined,
                expect.arrayContaining([
                    {
                        author: "Selected message",
                        text: "Selected voice",
                        hasImage: false,
                        imageIncluded: false,
                        hasAudio: true,
                        audioIncluded: true,
                    },
                ]),
                bytes,
                "audio/webm;codecs=opus",
            );
            expect(infer.mock.calls[0][3]).toBe(bytes);
        },
    );

    it("requests explicit audio mode for a referenced voice while image requests keep the default", async () => {
        const ref = { canisterId: "ucwa4-rx777-77774-qaada-cai", blobId: 4n };
        const bytes = new Uint8Array([4, 5]);
        const api = client();
        api.downloadPublicBlob.mockResolvedValue(bytes);
        const infer = vi.fn<typeof runLocalAiCommand>(
            async () => ({ kind: "ok", reply: "read" }) as const,
        );
        const runner = createLocalAiComposerRunner({ infer });
        await expect(
            runner.run(request(api, { repliedContent: voice({ blobReference: ref }) })),
        ).resolves.toEqual({ kind: "sent" });
        expect(api.downloadPublicBlob).toHaveBeenNthCalledWith(1, ref, 10 * 1024 * 1024, "audio");
        await expect(
            runner.run(
                request(api, {
                    attachment: {
                        kind: "image_content",
                        blobReference: ref,
                    } as AttachmentContent,
                }),
            ),
        ).resolves.toEqual({ kind: "sent" });
        expect(api.downloadPublicBlob).toHaveBeenNthCalledWith(2, ref, 5 * 1024 * 1024);
    });

    it("prefers an explicit staged image over a replied voice and does not read unrelated media", async () => {
        const bytes = new Uint8Array([5]);
        const readAudio = vi.fn();
        const infer = vi.fn<typeof runLocalAiCommand>(
            async () => ({ kind: "ok", reply: "image" }) as const,
        );
        const runner = createLocalAiComposerRunner({ infer, readAudio });
        await expect(
            runner.run(
                request(client(), {
                    attachment: { kind: "image_content", blobData: bytes } as AttachmentContent,
                    repliedContent: voice({ blobData: new Uint8Array([6]) }),
                }),
            ),
        ).resolves.toEqual({ kind: "sent" });
        expect(readAudio).not.toHaveBeenCalled();
        expect(infer.mock.calls[0][1]).toBe(bytes);
        expect(infer.mock.calls[0][3]).toBeUndefined();
    });

    it("quotes only a selected text reply and does not infer unloaded chat history", async () => {
        const infer = vi.fn<typeof runLocalAiCommand>(
            async () => ({ kind: "ok", reply: "summary" }) as const,
        );
        const runner = createLocalAiComposerRunner({ infer });
        await runner.run(
            request(client(), {
                context: [],
                repliedContent: { kind: "text_content", text: "Bring the draft" } as MessageContent,
            }),
        );
        expect(infer.mock.calls[0][2]).toEqual([
            { author: "Selected message", text: "Bring the draft" },
        ]);
    });

    it("does not silently run text inference when voice loading fails", async () => {
        const api = client();
        const infer = vi.fn<typeof runLocalAiCommand>();
        const runner = createLocalAiComposerRunner({ infer });
        const result = await runner.run(request(api, { repliedContent: voice() }));
        expect(result).toMatchObject({
            kind: "error",
            error: expect.stringContaining("voice message could not be read"),
        });
        expect(infer).not.toHaveBeenCalled();
        expect(api.sendMessageWithContent).not.toHaveBeenCalled();
        expect(runner.running).toBe(false);
    });

    it("does not start inference after a voice download resolves into a destroyed or changed view", async () => {
        const input = deferred<{ audio: Uint8Array; audioMimeType: string } | undefined>();
        const api = client();
        const infer = vi.fn<typeof runLocalAiCommand>();
        let current = true;
        const runner = createLocalAiComposerRunner({ infer, readAudio: () => input.promise });
        const pending = runner.run(
            request(api, { repliedContent: voice(), stillCurrent: () => current }),
        );
        current = false;
        input.resolve({ audio: new Uint8Array([1]), audioMimeType: "audio/wav" });
        await expect(pending).resolves.toEqual({ kind: "stale" });
        expect(infer).not.toHaveBeenCalled();
        expect(api.sendMessageWithContent).not.toHaveBeenCalled();
    });

    it.each(["unavailable", "error"] as const)(
        "surfaces explicit audio %s without posting or retrying",
        async (kind) => {
            const result =
                kind === "unavailable"
                    ? { kind, reason: "Install the optional audio add-on." }
                    : { kind, error: "Audio decode failed." };
            const api = client();
            const infer = vi.fn<typeof runLocalAiCommand>(async () => result);
            const runner = createLocalAiComposerRunner({ infer });
            await expect(
                runner.run(request(api, { attachment: voice({ blobData: new Uint8Array([1]) }) })),
            ).resolves.toEqual(result);
            expect(infer).toHaveBeenCalledOnce();
            expect(api.sendMessageWithContent).not.toHaveBeenCalled();
        },
    );
});

describe("local AI composer context capture", () => {
    it("distinguishes the exact captured viewer, chat, and thread", () => {
        const captured = captureLocalAiComposerContext("viewer-a", CHAT_A);

        expect(localAiComposerContextIsCurrent(captured, "viewer-a", CHAT_A)).toBe(true);
        expect(localAiComposerContextIsCurrent(captured, "viewer-b", CHAT_A)).toBe(false);
        expect(localAiComposerContextIsCurrent(captured, "viewer-a", CHAT_B)).toBe(false);
        expect(
            localAiComposerContextIsCurrent(captured, "viewer-a", {
                ...CHAT_A,
                threadRootMessageIndex: 10,
            }),
        ).toBe(false);
    });
});

describe("local AI composer runner", () => {
    it.each(["account", "chat"] as const)(
        "drops a deferred model result after the %s changes",
        async (changed) => {
            const inference = deferred<{ kind: "ok"; reply: string }>();
            const api = client();
            let viewer = "viewer-a";
            let currentContext = CHAT_A;
            const captured = captureLocalAiComposerContext(viewer, currentContext);
            const runner = createLocalAiComposerRunner({ infer: () => inference.promise });

            const pending = runner.run(
                request(api, {
                    captured,
                    stillCurrent: () =>
                        localAiComposerContextIsCurrent(captured, viewer, currentContext),
                }),
            );
            if (changed === "account") viewer = "viewer-b";
            else currentContext = CHAT_B;
            inference.resolve({ kind: "ok", reply: "private result" });

            await expect(pending).resolves.toEqual({ kind: "stale" });
            expect(api.sendMessageWithContent).not.toHaveBeenCalled();
        },
    );

    it("uses one single flight and does not accept a second visible prompt", async () => {
        const inference = deferred<{ kind: "ok"; reply: string }>();
        const api = client();
        const runner = createLocalAiComposerRunner({ infer: () => inference.promise });
        const firstAccepted = vi.fn();
        const secondAccepted = vi.fn();

        const first = runner.run(request(api, { onAccepted: firstAccepted }));
        await expect(runner.run(request(api, { onAccepted: secondAccepted }))).resolves.toEqual({
            kind: "busy",
        });
        expect(runner.running).toBe(true);
        expect(firstAccepted).toHaveBeenCalledOnce();
        expect(secondAccepted).not.toHaveBeenCalled();

        inference.resolve({ kind: "ok", reply: "done" });
        await expect(first).resolves.toEqual({ kind: "sent" });
        expect(runner.running).toBe(false);
    });

    it("forwards both in-memory and settled URL image bytes with bounded chat context", async () => {
        const inline = new Uint8Array([1, 2, 3]);
        const settled = new Uint8Array([4, 5, 6]);
        const infer = vi.fn<typeof runLocalAiCommand>(
            async () => ({ kind: "ok", reply: "read" }) as const,
        );
        const api = client();
        const fetchImage = vi.fn(
            async () =>
                new Response(settled, {
                    status: 200,
                    headers: { "content-length": String(settled.byteLength) },
                }),
        );
        vi.stubGlobal("fetch", fetchImage);
        const runner = createLocalAiComposerRunner({ infer });

        await expect(
            runner.run(
                request(api, {
                    attachment: {
                        kind: "image_content",
                        blobData: inline,
                    } as AttachmentContent,
                }),
            ),
        ).resolves.toEqual({ kind: "sent" });
        await expect(
            runner.run(
                request(api, {
                    attachment: {
                        kind: "image_content",
                        blobUrl: "https://openchat.example/settled-image.jpg",
                    } as AttachmentContent,
                }),
            ),
        ).resolves.toEqual({ kind: "sent" });

        expect(infer).toHaveBeenNthCalledWith(
            1,
            "summarize this chat",
            inline,
            expect.arrayContaining([{ author: "Mickey", text: "The meeting starts at noon" }]),
            undefined,
            undefined,
        );
        expect(infer).toHaveBeenNthCalledWith(
            2,
            "summarize this chat",
            settled,
            expect.arrayContaining([{ author: "Alex", text: "Bring the draft" }]),
            undefined,
            undefined,
        );
        expect(fetchImage).toHaveBeenCalledWith(
            "https://openchat.example/settled-image.jpg",
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it("posts only to the captured context and reports a rejected reply send", async () => {
        const api = client({ kind: "failure" });
        const runner = createLocalAiComposerRunner({
            infer: async () => ({ kind: "ok", reply: "answer" }),
        });
        const captured = captureLocalAiComposerContext("viewer-a", CHAT_A);

        await expect(runner.run(request(api, { captured }))).resolves.toEqual({
            kind: "error",
            error: "could not post the AI response (failure)",
        });
        expect(api.sendMessageWithContent).toHaveBeenCalledWith(
            captured.messageContext,
            { kind: "text_content", text: "🤖 answer" },
            true,
            [],
            false,
        );
        expect(captured.messageContext).not.toBe(CHAT_A);
    });

    it("does not start WebGPU inference after a deferred image load becomes stale", async () => {
        const bytes = deferred<Uint8Array | undefined>();
        const infer = vi.fn<typeof runLocalAiCommand>(
            async () => ({ kind: "ok", reply: "should not run" }) as const,
        );
        const api = client();
        let current = true;
        const runner = createLocalAiComposerRunner({
            readImage: () => bytes.promise,
            infer,
        });
        const pending = runner.run(
            request(api, {
                attachment: {
                    kind: "image_content",
                    blobData: new Uint8Array([1]),
                } as AttachmentContent,
                stillCurrent: () => current,
            }),
        );

        current = false;
        bytes.resolve(new Uint8Array([1]));
        await expect(pending).resolves.toEqual({ kind: "stale" });
        expect(infer).not.toHaveBeenCalled();
        expect(api.sendMessageWithContent).not.toHaveBeenCalled();
    });
});
