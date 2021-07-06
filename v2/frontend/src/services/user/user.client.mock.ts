import type {
    DirectChatSummary,
    GetChatsResponse,
    GroupChatSummary,
    Message,
} from "../../domain/chat";
import type { IUserClient } from "./user.client.interface";

const oneDay = 1000 * 60 * 60 * 24;
let nextChatId = 0;
let time = +new Date() + oneDay;

function randomNum(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomString() {
    return (
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
}

function mockGroupChat(): GroupChatSummary {
    time -= oneDay;
    return {
        kind: "group_chat",
        subject: "Group chat subject",
        chatId: BigInt(nextChatId++),
        lastUpdated: BigInt(time),
        displayDate: BigInt(time),
        lastReadByUs: 0,
        lastReadByThem: 0,
        lastestMessageId: 500,
        latestMessage: mockMessage(),
    };
}

function mockDirectChat(): DirectChatSummary {
    time -= oneDay;
    const latest = randomNum(10, 20);
    const us = randomNum(10, latest);
    return {
        kind: "direct_chat",
        them: randomString(),
        chatId: BigInt(nextChatId++),
        lastUpdated: BigInt(time),
        displayDate: BigInt(time),
        lastReadByUs: us,
        lastReadByThem: 0,
        lastestMessageId: latest,
        latestMessage: mockMessage(),
    };
}

function mockMessage(): Message {
    return {
        id: 123,
        content: {
            kind: "text_content",
            text: "This is the test message",
        },
        sender: "",
        timestamp: BigInt(+new Date()),
        clientMessageId: "",
    };
}

function createN<T>(n: number, factory: () => T, sofar: T[] = []): T[] {
    if (n > 0) {
        sofar.push(factory());
        return createN(n - 1, factory, sofar);
    }
    return sofar;
}

export class UserClientMock implements IUserClient {
    getChats(): Promise<GetChatsResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    chats: [...createN(10, mockDirectChat), ...createN(10, mockGroupChat)],
                });
            }, 1000);
        });
    }
}
