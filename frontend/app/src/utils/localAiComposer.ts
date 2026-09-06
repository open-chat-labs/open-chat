import type { AttachmentContent, MessageContent, MessageContext, OpenChat } from "@client";
import { messageContextsEqual } from "@client";
import { localAudioInput } from "./localAudioInput";
import { localImageBytes } from "./localImageInput";
import { runLocalAiCommand, type LocalAiChatMessage } from "./localAiCommand";

type LocalAiComposerClient = Pick<OpenChat, "downloadPublicBlob" | "sendMessageWithContent">;

export type LocalAiComposerOutcome =
    | { kind: "sent" }
    | { kind: "busy" }
    | { kind: "stale" }
    | { kind: "unavailable"; reason: string }
    | { kind: "error"; error: string };

export interface CapturedLocalAiComposerContext {
    viewer: string;
    messageContext: MessageContext;
}

export interface LocalAiComposerRequest {
    client: LocalAiComposerClient;
    prompt: string;
    attachment?: AttachmentContent;
    repliedContent?: MessageContent;
    context?: LocalAiChatMessage[];
    captured: CapturedLocalAiComposerContext;
    stillCurrent: () => boolean;
    // The normal composer send owns attachment upload and the visible user prompt. It must run
    // synchronously, before the first await, while its parent callback still belongs to this chat.
    onAccepted: () => void;
}

interface LocalAiComposerDependencies {
    readImage: typeof localImageBytes;
    readAudio: typeof localAudioInput;
    infer: typeof runLocalAiCommand;
}

export interface LocalAiComposerRunner {
    readonly running: boolean;
    run: (request: LocalAiComposerRequest) => Promise<LocalAiComposerOutcome>;
}

export function captureLocalAiComposerContext(
    viewer: string,
    messageContext: MessageContext,
): CapturedLocalAiComposerContext {
    return {
        viewer,
        messageContext: {
            chatId: { ...messageContext.chatId },
            ...(messageContext.threadRootMessageIndex === undefined
                ? {}
                : { threadRootMessageIndex: messageContext.threadRootMessageIndex }),
        },
    };
}

export function localAiComposerContextIsCurrent(
    captured: CapturedLocalAiComposerContext,
    viewer: string,
    messageContext: MessageContext,
): boolean {
    return (
        captured.viewer === viewer && messageContextsEqual(captured.messageContext, messageContext)
    );
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function createLocalAiComposerRunner(
    overrides: Partial<LocalAiComposerDependencies> = {},
): LocalAiComposerRunner {
    const dependencies: LocalAiComposerDependencies = {
        readImage: localImageBytes,
        readAudio: localAudioInput,
        infer: runLocalAiCommand,
        ...overrides,
    };
    let running = false;

    async function execute(request: LocalAiComposerRequest): Promise<LocalAiComposerOutcome> {
        try {
            if (!request.stillCurrent()) return { kind: "stale" };

            // Reserve the run before posting the visible prompt. `run` sets `running` synchronously,
            // so a second click/Enter cannot post another prompt while this request is in flight.
            const content = request.attachment ?? request.repliedContent;
            request.onAccepted();

            let image: Uint8Array | undefined;
            let audio: Uint8Array | undefined;
            let audioMimeType: string | undefined;
            if (content?.kind === "image_content") {
                image = await dependencies.readImage(content, (ref, maxBytes) =>
                    request.client.downloadPublicBlob(ref, maxBytes),
                );
                if (!request.stillCurrent()) return { kind: "stale" };
                if (image === undefined) {
                    return {
                        kind: "error",
                        error: "The selected image could not be read for local AI processing.",
                    };
                }
            } else if (content?.kind === "audio_content") {
                const input = await dependencies.readAudio(content, (ref, maxBytes) =>
                    request.client.downloadPublicBlob(ref, maxBytes, "audio"),
                );
                if (!request.stillCurrent()) return { kind: "stale" };
                if (input === undefined) {
                    return {
                        kind: "error",
                        error: "The selected voice message could not be read. Use an audio message up to 30 seconds and 10 MiB.",
                    };
                }
                ({ audio, audioMimeType } = input);
            }

            if (!request.stillCurrent()) return { kind: "stale" };
            // Only the explicitly selected attachment/reply is supplied. Unrelated or unloaded chat
            // history is never implied, and quoted message content cannot replace the user's prompt.
            const context = [...(request.context ?? [])];
            if (content?.kind === "text_content") {
                context.push({ author: "Selected message", text: content.text });
            } else if (content?.kind === "image_content" || content?.kind === "audio_content") {
                context.push({
                    author: "Selected message",
                    text: content.caption,
                    hasImage: image !== undefined,
                    imageIncluded: image !== undefined,
                    hasAudio: audio !== undefined,
                    audioIncluded: audio !== undefined,
                });
            }
            const inference = await dependencies.infer(
                request.prompt,
                image,
                context,
                audio,
                audioMimeType,
            );
            if (!request.stillCurrent()) return { kind: "stale" };
            if (inference.kind !== "ok") return inference;

            const reply = inference.reply.length > 0 ? inference.reply : "(no output)";
            // `captured.messageContext`, not the live Svelte prop, is the destination. The guard is
            // checked immediately before initiating the write so an account/chat switch cannot make
            // the selected model's output cross into a newly selected conversation.
            if (!request.stillCurrent()) return { kind: "stale" };
            const response = await request.client.sendMessageWithContent(
                request.captured.messageContext,
                { kind: "text_content", text: `🤖 ${reply}` },
                true,
                [],
                false,
            );
            if (!request.stillCurrent()) return { kind: "stale" };
            if (response.kind !== "success") {
                return {
                    kind: "error",
                    error: `could not post the AI response (${response.kind})`,
                };
            }
            return { kind: "sent" };
        } catch (error) {
            return request.stillCurrent()
                ? { kind: "error", error: errorMessage(error) }
                : { kind: "stale" };
        }
    }

    return {
        get running() {
            return running;
        },
        run(request) {
            if (running) return Promise.resolve({ kind: "busy" });
            running = true;
            return execute(request).finally(() => {
                running = false;
            });
        },
    };
}
