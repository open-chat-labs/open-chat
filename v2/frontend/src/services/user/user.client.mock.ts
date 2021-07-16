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

const oneDay = 1000 * 60 * 60 * 24;
let time = +new Date() + oneDay;

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
        latestMessageIndex: 1000,
        latestMessage: mockTextMessage(1000),
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
        latestMessageIndex: 1000,
        latestMessage: mockTextMessage(1000),
    };
}

function mockRepliesTo(index: number): ReplyContext {
    const sentByMe = index % 4 === 0;
    return {
        kind: "direct_standard_reply_context",
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        sentByMe,
        messageIndex: index - 100,
    };
}

function mockTextMessage(index: number): Message {
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
        timestamp: BigInt(+new Date()),
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
                    latestMessageIndex: 1000,
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
