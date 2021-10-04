/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions, assign } from "xstate";
import type { ChatSummary, MarkReadResponse, MessageIndexRange } from "../domain/chat/chat";
import { insertIndexIntoRanges } from "../domain/chat/chat.utils";
import type { ServiceContainer } from "../services/serviceContainer";

/**
 * This machine exists to periodically sync read message state to the backend
 */

const MARK_READ_INTERVAL = 2000;

type Messages = {
    indexRanges: MessageIndexRange[];
    ids: Set<bigint>;
};

export interface MarkReadContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    capturedMessages: Messages;
    pendingMessages: Messages;
    unconfirmed: Set<bigint>;
}

export type MarkReadEvents =
    | { type: "MESSAGE_READ_BY_ME"; data: { messageIndex: number; messageId: bigint } }
    | { type: "done.invoke.markMessageRead"; data: MarkReadResponse[] }
    | { type: "error.platform.markMessageRead"; data: Error };

const liveConfig: Partial<MachineOptions<MarkReadContext, MarkReadEvents>> = {
    services: {
        markMessagesRead: async (ctx, _) => {
            if (
                ctx.pendingMessages.indexRanges.length === 0 &&
                ctx.pendingMessages.ids.size === 0
            ) {
                return Promise.resolve("success");
            } else {
                if (ctx.chatSummary.kind === "direct_chat") {
                    return ctx.serviceContainer.markDirectChatMessagesRead(
                        ctx.chatSummary.them,
                        ctx.pendingMessages.indexRanges,
                        ctx.pendingMessages.ids
                    );
                } else if (ctx.chatSummary.kind === "group_chat") {
                    return ctx.serviceContainer.markGroupChatMessagesRead(
                        ctx.chatSummary.chatId,
                        ctx.pendingMessages.indexRanges,
                        ctx.pendingMessages.ids
                    );
                }
            }
            throw new Error("fix me");
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<MarkReadContext, any, MarkReadEvents> = {
    id: "mark_read_machine",
    initial: "idle",
    on: {
        MESSAGE_READ_BY_ME: {
            actions: assign((ctx, ev) => {
                if (ctx.unconfirmed.has(ev.data.messageId)) {
                    return {
                        capturedMessages: {
                            indexRanges: ctx.capturedMessages.indexRanges,
                            ids: ctx.capturedMessages.ids.add(ev.data.messageId),
                        },
                    };
                } else {
                    return {
                        capturedMessages: {
                            indexRanges: insertIndexIntoRanges(
                                ev.data.messageIndex,
                                ctx.capturedMessages.indexRanges
                            ),
                            ids: ctx.capturedMessages.ids,
                        },
                    };
                }
            }),
        },
    },
    states: {
        idle: {
            after: {
                [MARK_READ_INTERVAL]: "marking_as_read",
            },
        },
        marking_as_read: {
            entry: assign((ctx, _) => ({
                // capture the buffer that we are going to send
                pendingMessages: ctx.capturedMessages,
                capturedMessages: {
                    indexRanges: [],
                    ids: new Set<bigint>(),
                },
            })),
            invoke: {
                id: "markMessagssRead",
                src: "markMessagesRead",
                onDone: {
                    target: "idle",
                },
                onError: "idle",
            },
        },
    },
};

export const markReadMachine = createMachine<MarkReadContext, MarkReadEvents>(schema, liveConfig);
export type MarkReadMachine = typeof markReadMachine;
