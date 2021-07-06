import type { Principal } from "@dfinity/principal";
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
    return {
        kind: "direct_chat",
        them: {} as Principal,
        chatId: BigInt(nextChatId++),
        lastUpdated: BigInt(time),
        displayDate: BigInt(time),
        lastReadByUs: 0,
        lastReadByThem: 0,
        lastestMessageId: 5,
        latestMessage: mockMessage(),
    };
}

function mockChatUser() {
    return {
        userId: {} as Principal,
        username: "julian_jelfs_123",
        lastOnline: BigInt(+new Date() - 50000),
    };
}

function mockMessage(): Message {
    return {
        id: 123,
        content: {
            kind: "text_content",
            text: "This is the test message",
        },
        sender: {} as Principal,
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
                    users: createN(10, mockChatUser),
                });
            }, 1000);
        });
    }
}
