import type {
    ChatSummary,
    DirectChatSummary,
    GetChatsResponse,
    GetMessagesResponse,
    GroupChatSummary,
    Message,
} from "../../domain/chat/chat";
import type { IUserClient } from "./user.client.interface";

const oneDay = 1000 * 60 * 60 * 24;
let time = +new Date() + oneDay;

function randomNum(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomString() {
    return (
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
}

function mockGroupChat(i: number): GroupChatSummary {
    time -= oneDay;
    const participants = new Array(randomNum(0, 200)).fill("").map(randomString);
    return {
        kind: "group_chat",
        subject: "Group chat subject",
        chatId: String(i),
        lastUpdated: BigInt(time),
        displayDate: BigInt(time),
        lastReadByUs: 0,
        lastReadByThem: 0,
        lastestMessageIndex: 500,
        latestMessage: mockMessage(),
        participants,
    };
}

function mockDirectChat(i: number): DirectChatSummary {
    time -= oneDay;
    const latest = randomNum(10, 20);
    const us = randomNum(10, latest);
    return {
        kind: "direct_chat",
        them: randomString(),
        chatId: String(i),
        lastUpdated: BigInt(time),
        displayDate: BigInt(time),
        lastReadByUs: us,
        lastReadByThem: 0,
        lastestMessageIndex: latest,
        latestMessage: mockMessage(),
    };
}

function mockMessage(): Message {
    return {
        messageId: BigInt(123),
        messageIndex: 456,
        content: {
            kind: "text_content",
            text: "This is the test message",
        },
        sender: "",
        timestamp: BigInt(+new Date()),
    };
}

function createN<T>(seed: number, n: number, factory: (n: number) => T, sofar: T[] = []): T[] {
    if (n > 0) {
        sofar.push(factory(seed + n));
        return createN(seed, n - 1, factory, sofar);
    }
    return sofar;
}

export class UserClientMock implements IUserClient {
    directChatMessages(
        _userId: string,
        _fromIndex: number,
        _toIndex: number
    ): Promise<GetMessagesResponse> {
        throw new Error("Method not implemented.");
    }

    getChats(since: bigint): Promise<GetChatsResponse> {
        const numChats = since === BigInt(0) ? 2 : 4;
        const direct = createN(0, numChats, mockDirectChat);
        const group = createN(100, numChats, mockGroupChat);
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
