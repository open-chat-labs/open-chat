import type {
    ChatSummary,
    DirectChatSummary,
    UpdatesResponse,
    EventsResponse,
    GroupChatSummary,
    Message,
    ReplyContext,
    UpdateArgs,
    Participant,
    UpdatedChatSummary,
    EventWrapper,
} from "../../domain/chat/chat";
import { fill, randomNum, randomPara, randomWord } from "../../utils/mockutils";
import type { IUserClient } from "./user.client.interface";

const numMessages = 1000;
const oneDay = 1000 * 60 * 60 * 24;
let time = +new Date() + oneDay;
const interval = 1000 * 60 * 60 * 8; // 8 hours

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
        minVisibleMessageIndex: 0,
        chatId: String(i),
        lastUpdated: BigInt(time),
        latestReadByMe: numMessages,
        latestMessage: mockEvent(numMessages),
        latestEventIndex: numMessages,
        participants,
    };
}

const others = ["qwxyz", "mnopr", "rstuv"];

function mockDirectChat(i: number): DirectChatSummary {
    time -= oneDay;
    const us = randomNum(10, 1000);
    return {
        kind: "direct_chat",
        them: others[i % 3],
        chatId: String(i),
        lastUpdated: BigInt(time),
        latestReadByMe: us,
        latestReadByThem: 0,
        latestMessage: mockEvent(numMessages),
        latestEventIndex: numMessages,
        dateCreated: BigInt(time),
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
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    return {
        kind: "message",
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        sender,
        repliesTo,
    };
}

function mockEvent(index: number): EventWrapper {
    const now = +new Date();
    const numIntervals = numMessages - index;
    const timeDiff = interval * numIntervals;

    return {
        event: mockTextMessage(index),
        timestamp: BigInt(+new Date(now - timeDiff)),
        index,
    };
}

// todo - initially just keep things mostly the same
function updateChat(chat: ChatSummary, i: number): UpdatedChatSummary {
    const uppercase = i % 2 === 0;

    if (chat.kind === "group_chat") {
        const removeParticipant = chat.participants[randomNum(0, chat.participants.length - 1)];
        return {
            chatId: chat.chatId,
            lastUpdated: BigInt(+new Date()),
            latestReadByMe: chat.latestReadByMe,
            latestEventIndex: chat.latestEventIndex + 2,
            latestMessage: chat.latestMessage
                ? mockEvent(chat.latestMessage?.index + 2)
                : undefined,
            kind: "group_chat",
            participantsAdded: [],
            participantsRemoved: removeParticipant
                ? new Set([removeParticipant.userId])
                : new Set([]),
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
        latestEventIndex: chat.latestEventIndex,
        kind: "direct_chat",
        latestReadByThem: chat.latestReadByThem,
    };
}

export class UserClientMock implements IUserClient {
    chatEvents(_userId: string, fromIndex: number, toIndex: number): Promise<EventsResponse> {
        const n = toIndex - fromIndex;
        const events = fill(n + 1, mockEvent, (i: number) => fromIndex + i);
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    events,
                });
            }, 300);
        });
    }

    chatEventsByIndex(_userId: string, indexes: Set<number>): Promise<EventsResponse> {
        const events = [...indexes].map((i) => {
            return mockEvent(i);
        });
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    events,
                });
            }, 300);
        });
    }

    private updateCycles = -1;

    private previousChats: ChatSummary[] = [];

    getUpdates(_userId: string, args: UpdateArgs): Promise<UpdatesResponse> {
        this.updateCycles += 1;
        const direct = fill(3, mockDirectChat);
        const group = fill(3, mockGroupChat, (i: number) => i + 1000);

        const add = args.lastUpdated
            ? this.updateCycles % 5 === 0
                ? fill(1, mockDirectChat, (i) => i + this.previousChats.length)
                : []
            : ([] as ChatSummary[]).concat(direct, group);

        const resp = {
            chatsUpdated: args.lastUpdated
                ? this.previousChats.map((c) => updateChat(c, this.updateCycles))
                : [],
            chatsAdded: add,
            chatsRemoved: new Set([]),
            timestamp: BigInt(+new Date()),
        };

        this.previousChats = [...this.previousChats, ...add].sort((a, b) =>
            Number(a.lastUpdated - b.lastUpdated)
        );

        return new Promise((res) => {
            setTimeout(() => {
                res(resp);
            }, 500);
        });
    }
}
