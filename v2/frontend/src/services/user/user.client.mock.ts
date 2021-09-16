import type {
    ChatSummary,
    DirectChatSummary,
    EventsResponse,
    GroupChatSummary,
    UpdateArgs,
    Participant,
    ChatSummaryUpdates,
    EventWrapper,
    CandidateGroupChat,
    CreateGroupResponse,
    DirectChatEvent,
    GroupMessage,
    DirectMessage,
    GroupChatReplyContext,
    DirectChatReplyContext,
    MergedUpdatesResponse,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MessageIndexRange,
    MarkReadResponse,
} from "../../domain/chat/chat";
import { mergeChatUpdates, newMessageId } from "../../domain/chat/chat.utils";
import { fill, randomNum, randomPara, randomWord } from "../../utils/mockutils";
import type { IUserClient } from "./user.client.interface";

export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB
const numMessages = 1000;
const oneDay = 1000 * 60 * 60 * 24;
let time = +new Date() + oneDay;
const interval = 1000 * 60 * 60 * 8; // 8 hours

type MessageKind = "group_message" | "direct_message";

function mockGroupChat(i: number): GroupChatSummary {
    time -= oneDay;
    const participants: Participant[] = fill(randomNum(10, 1200), (i: number) => ({
        role: i % 2 === 0 ? "admin" : "standard",
        userId: `${randomWord(5)}_${i}`,
    }));

    participants.push({
        userId: "abcdefg",
        role: i % 2 === 0 ? "admin" : "standard",
    });
    return {
        kind: "group_chat",
        name: randomPara(4),
        description: randomPara(20),
        public: false,
        joined: BigInt(time),
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        chatId: String(i),
        lastUpdated: BigInt(time),
        readByMe: [],
        latestMessage: mockEvent<GroupMessage>("group_message", numMessages),
        latestEventIndex: numMessages,
        participants,
    };
}

const others = ["qwxyz", "mnopr", "rstuv"];

function mockDirectChat(i: number): DirectChatSummary {
    time -= oneDay;
    return {
        kind: "direct_chat",
        them: others[i % 3],
        chatId: String(i),
        readByMe: [],
        readByThem: [],
        latestMessage: mockEvent("direct_message", numMessages),
        latestEventIndex: numMessages,
        dateCreated: BigInt(time),
    };
}

function mockRepliesTo(index: number): GroupChatReplyContext | DirectChatReplyContext {
    const jumpTo = randomNum(index - 100, index - 1);
    const sentByMe = index % 4 === 0;
    const privateReply = index % 3 === 0;
    if (privateReply) {
        // todo - private reply context does not contain content so what are we supposed to display?
        return {
            kind: "direct_private_reply_context",
            eventIndex: jumpTo,
            chatId: "1000",
        };
    }
    return {
        kind: "direct_standard_reply_context",
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        sentByMe,
        eventIndex: jumpTo,
    };
}

type MimeType = "image/jpg" | "video/mp4" | "audio/mp3";

function mockMediaMessage<T extends GroupMessage | DirectMessage>(
    kind: MessageKind,
    index: number,
    mimeType: MimeType
): T {
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    const blobId =
        mimeType === "image/jpg"
            ? BigInt(0)
            : mimeType === "video/mp4"
            ? BigInt(1)
            : mimeType === "audio/mp3"
            ? BigInt(3)
            : BigInt(4);
    return {
        kind,
        content: {
            kind: "media_content",
            caption: "A picture of a bird",
            height: 201,
            width: 250,
            mimeType,
            blobReference: {
                blobSize: CHUNK_SIZE_BYTES * 2,
                blobId,
                canisterId: "doesnt_matter",
                chunkSize: CHUNK_SIZE_BYTES,
            },
            thumbnailData:
                "data:image/png;base64,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",
        },
        sender,
        repliesTo,
        messageId: newMessageId(),
        messageIndex: index,
    } as T;
}

function mockFileMessage<T extends GroupMessage | DirectMessage>(
    kind: MessageKind,
    index: number
): T {
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    return {
        kind,
        content: {
            kind: "file_content",
            caption: "A picture of a bird",
            mimeType: "application/pdf",
            name: "somefile_for_us_to_download.pdf",
            blobReference: {
                blobSize: CHUNK_SIZE_BYTES * 2,
                blobId: BigInt(2),
                canisterId: "doesnt_matter",
                chunkSize: CHUNK_SIZE_BYTES,
            },
        },
        sender,
        repliesTo,
        messageId: newMessageId(),
        messageIndex: index,
    } as T;
}

function mockTextMessage<T extends GroupMessage | DirectMessage>(
    kind: MessageKind,
    index: number
): T {
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    return {
        kind,
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        sender,
        repliesTo,
        messageId: newMessageId(),
        messageIndex: index,
    } as T;
}

function directChatCreated(index: number): EventWrapper<DirectChatEvent> {
    const now = +new Date();
    const numIntervals = numMessages - index;
    const timeDiff = interval * numIntervals;
    return {
        event: {
            kind: "direct_chat_created",
        },
        timestamp: BigInt(+new Date(now - timeDiff)),
        index,
    };
}

function mockEvent<T extends GroupMessage | DirectMessage>(
    kind: MessageKind,
    index: number
): EventWrapper<T> {
    const now = +new Date();
    const numIntervals = numMessages - index;
    const timeDiff = interval * numIntervals;

    const n = randomNum(0, 4);
    const msg =
        n === 0
            ? mockTextMessage<T>(kind, index)
            : n === 1
            ? mockMediaMessage<T>(kind, index, "image/jpg")
            : n === 2
            ? mockFileMessage<T>(kind, index)
            : n === 3
            ? mockMediaMessage<T>(kind, index, "video/mp4")
            : mockMediaMessage<T>(kind, index, "audio/mp3");

    return {
        event: msg as T,
        timestamp: BigInt(+new Date(now - timeDiff)),
        index,
    };
}

// todo - initially just keep things mostly the same
function updateChat(chat: ChatSummary, i: number): ChatSummaryUpdates {
    const uppercase = i % 2 === 0;

    if (chat.kind === "group_chat") {
        const removeParticipant = chat.participants[randomNum(0, chat.participants.length - 1)];
        return {
            chatId: chat.chatId,
            lastUpdated: BigInt(+new Date()),
            readByMe: chat.readByMe,
            latestEventIndex: chat.latestEventIndex + 2,
            latestMessage: chat.latestMessage
                ? mockEvent<GroupMessage>("group_message", chat.latestMessage?.index + 2)
                : undefined,
            kind: "group_chat",
            participantsAddedOrUpdated: [],
            participantsRemoved: removeParticipant
                ? new Set([removeParticipant.userId])
                : new Set([]),
            name: uppercase ? chat.name.toUpperCase() : chat.name.toLowerCase(),
            description: chat.description,
        };
    }
    return {
        chatId: chat.chatId,
        readByMe: [],
        readByThem: [{ from: 0, to: Number.MAX_VALUE }],
        latestMessage: chat.latestMessage,
        latestEventIndex: chat.latestEventIndex,
        kind: "direct_chat",
    };
}

export class UserClientMock implements IUserClient {
    chatEvents(
        _userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        const n = toIndex - fromIndex;
        const events = fill(
            n + 1,
            (i: number) => {
                return fromIndex + i === 0
                    ? directChatCreated(i)
                    : mockEvent<DirectMessage>("direct_message", i);
            },
            (i: number) => fromIndex + i
        );
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    events,
                });
            }, 300);
        });
    }

    private updateCycles = -1;

    getUpdates(chatSummaries: ChatSummary[], args: UpdateArgs): Promise<MergedUpdatesResponse> {
        this.updateCycles += 1;
        const direct = fill(3, mockDirectChat);
        const group = fill(3, mockGroupChat, (i: number) => i + 1000);

        const add = args.updatesSince
            ? this.updateCycles % 5 === 0
                ? fill(1, mockDirectChat, (i) => i + chatSummaries.length)
                : []
            : ([] as ChatSummary[]).concat(direct, group);

        const resp = {
            blockedUsers: new Set<string>(),
            chatsUpdated: args.updatesSince
                ? chatSummaries.map((c) => updateChat(c, this.updateCycles))
                : [],
            chatsAdded: add,
            chatsRemoved: new Set([]),
            timestamp: BigInt(+new Date()),
        };

        return new Promise((res) => {
            setTimeout(() => {
                res({
                    chatSummaries: mergeChatUpdates(chatSummaries, resp),
                    timestamp: resp.timestamp,
                    blockedUsers: resp.blockedUsers,
                });
            }, 500);
        });
    }

    createGroup(_group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    kind: "success",
                    canisterId: randomWord(16),
                });
                // res({
                //     kind: "invalid_name",
                // });
            }, 5000);
        });
    }

    sendMessage(
        _recipientId: string,
        _senderName: string,
        message: DirectMessage
    ): Promise<SendMessageResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    kind: "send_message_success",
                    timestamp: BigInt(Number(+new Date())),
                    messageIndex: message.messageIndex,
                    eventIndex: message.messageIndex,
                });
            }, 2000);
        });
    }

    blockUser(_userId: string): Promise<BlockUserResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 500);
        });
    }

    unblockUser(_userId: string): Promise<UnblockUserResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 500);
        });
    }

    leaveGroup(_chatId: string): Promise<LeaveGroupResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 500);
        });
    }

    markMessagesRead(_userId: string, _ranges: MessageIndexRange[]): Promise<MarkReadResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 500);
        });
    }
}
