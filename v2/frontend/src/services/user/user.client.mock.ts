import type {
    ChatSummary,
    DirectChatSummary,
    UpdatesResponse,
    MessagesResponse,
    GroupChatSummary,
    Message,
    ReplyContext,
    UpdateArgs,
    Participant,
    UpdatedChatSummary,
} from "../../domain/chat/chat";
import { fill, randomNum, randomPara, randomWord } from "../../utils/mockutils";
import type { IUserClient } from "./user.client.interface";

const numMessages = 1000;
const oneDay = 1000 * 60 * 60 * 24;
let time = +new Date() + oneDay;
const interval = 1000 * 60 * 60 * 8; // 8 hours

function mockGroupChat(i: number): GroupChatSummary {
    time -= oneDay;
    const participants: Participant[] = fill(randomNum(0, 200), (i: number) => ({
        role: "admin",
        userId: `${randomWord(5)}_${i}`,
    }));
    return {
        kind: "group_chat",
        name: randomPara(4),
        description: randomPara(20),
        public: true,
        joined: BigInt(time),
        minVisibleMessageIndex: 0,
        chatId: String(i),
        lastUpdated: BigInt(time),
        latestReadByMe: 0,
        latestMessage: mockTextMessage(numMessages),
        participants,
    };
}

function mockDirectChat(i: number): DirectChatSummary {
    time -= oneDay;
    const us = randomNum(10, 1000);
    return {
        kind: "direct_chat",
        them: "qwxyz",
        chatId: String(i),
        lastUpdated: BigInt(time),
        latestReadByMe: us,
        latestReadByThem: 0,
        latestMessage: mockTextMessage(numMessages),
    };
}

function mockRepliesTo(index: number): ReplyContext {
    const jumpTo = randomNum(index - 100, index - 1);
    const sentByMe = index % 4 === 0;
    const privateReply = index % 3 === 0;
    if (privateReply) {
        // todo - private reply context does not contain content so what are we supposed to display?
        return {
            kind: "direct_private_reply_context",
            messageIndex: jumpTo,
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
        messageIndex: jumpTo,
    };
}

function mockTextMessage(index: number): Message {
    const now = +new Date();
    const numIntervals = numMessages - index;
    const timeDiff = interval * numIntervals;

    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    return {
        messageId: BigInt(index),
        messageIndex: index,
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        sender,
        timestamp: BigInt(+new Date(now - timeDiff)),
        repliesTo,
    };
}

// todo - initially just keep things mostly the same
function updateChat(chat: ChatSummary, i: number): UpdatedChatSummary {
    const uppercase = i % 2 === 0;

    if (chat.kind === "group_chat") {
        return {
            chatId: chat.chatId,
            lastUpdated: BigInt(+new Date()),
            latestReadByMe: chat.latestReadByMe,
            latestMessage: chat.latestMessage,
            kind: "group_chat",
            participantsAdded: [],
            participantsRemoved: new Set([]),
            participantsUpdated: [],
            name: uppercase ? chat.name.toUpperCase() : chat.name.toLowerCase(),
            description: chat.description,
        };
    }
    return {
        chatId: chat.chatId,
        lastUpdated: BigInt(+new Date()),
        latestReadByMe: chat.latestReadByMe,
        latestMessage: chat.latestMessage,
        kind: "direct_chat",
        latestReadByThem: chat.latestReadByThem,
    };
}

export class UserClientMock implements IUserClient {
    chatMessages(_userId: string, fromIndex: number, toIndex: number): Promise<MessagesResponse> {
        const n = toIndex - fromIndex;
        const messages = fill(n, mockTextMessage, (i: number) => fromIndex + i);
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    messages,
                    latestMessageIndex: numMessages,
                });
            }, 300);
        });
    }

    private updateCycles = -1;

    private previousChats: ChatSummary[] = [];

    getUpdates(args: UpdateArgs): Promise<UpdatesResponse> {
        this.updateCycles += 1;
        const direct = fill(3, mockDirectChat);
        const group = fill(3, mockGroupChat, (i: number) => i + 1000);

        const add = args.lastUpdated
            ? fill(1, mockDirectChat, (i) => i + this.previousChats.length)
            : ([] as ChatSummary[]).concat(direct, group);

        const resp = {
            chatsUpdated: args.lastUpdated
                ? this.previousChats.map((c) => updateChat(c, this.updateCycles))
                : [],
            chatsAdded: add,
            chatsRemoved: new Set([]),
            timestamp: BigInt(+new Date()),
        };

        this.previousChats = [...this.previousChats, ...add];

        return new Promise((res) => {
            setTimeout(() => {
                res(resp);
            }, 500);
        });
    }
}
