import type { MessagesResponse, Message, ReplyContext } from "../../domain/chat/chat";
import { fill, randomNum, randomPara } from "../../utils/mockutils";
import type { IGroupClient } from "./group.client.interface";

const numMessages = 1000;
const interval = 1000 * 60 * 60 * 8; // 8 hours

function mockRepliesTo(index: number): ReplyContext {
    const jumpTo = randomNum(index - 100, index - 1);
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    return {
        kind: "group_reply_context",
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        userId: sender,
        messageIndex: jumpTo,
        messageId: BigInt(0),
    };
}

const now = +new Date();

function mockTextMessage(index: number): Message {
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    return {
        messageId: BigInt(index),
        messageIndex: index,
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        sender,
        timestamp: BigInt(+new Date(now - index)),
        repliesTo,
    };
}

export class GroupClientMock implements IGroupClient {
    chatMessages(fromIndex: number, toIndex: number): Promise<MessagesResponse> {
        const n = toIndex - fromIndex;
        const messages = fill(n + 1, mockTextMessage, (i: number) => fromIndex + i);
        return new Promise((res) => {
            setTimeout(() => {
                res({
                    messages,
                });
            }, 300);
        });
    }
}
