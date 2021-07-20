import type {
    ChatSummary,
    DirectChatSummary,
    GetChatsResponse,
    GetMessagesResponse,
    GroupChatSummary,
    Message,
    ReplyContext,
} from "../../domain/chat/chat";
import { fill, randomNum, randomPara, randomWord } from "../../utils/mockutils";
import type { IUserClient } from "./user.client.interface";

const numMessages = 1000;
const oneDay = 1000 * 60 * 60 * 24;
let time = +new Date() + oneDay;
const interval = 1000 * 60 * 60 * 8; // 8 hours
const tinyInterval = 1000 * 30; // 30 seconds

function mockGroupChat(i: number): GroupChatSummary {
    time -= oneDay;
    const participants = fill(randomNum(0, 200), (i: number) => `${randomWord(5)}_${i}`);
    return {
        kind: "group_chat",
        subject: randomPara(4),
        chatId: String(i),
        lastUpdated: BigInt(time),
        displayDate: BigInt(time),
        lastReadByUs: 0,
        lastReadByThem: 0,
        latestMessageIndex: numMessages,
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
        displayDate: BigInt(time),
        lastReadByUs: us,
        lastReadByThem: 0,
        latestMessageIndex: numMessages,
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
    // const timeDiff = tinyInterval * numIntervals;
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

export class UserClientMock implements IUserClient {
    chatMessages(
        _userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<GetMessagesResponse> {
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

    getChats(since: bigint): Promise<GetChatsResponse> {
        const numChats = since === BigInt(0) ? 2 : 4;
        const direct = fill(numChats, mockDirectChat);
        const group = fill(numChats, mockGroupChat, (i: number) => i + 1000);
        const chats = ([] as ChatSummary[]).concat(direct, group);
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    chats,
                    timestamp: BigInt(+new Date()),
                });
            }, 1000);
        });
    }
}
