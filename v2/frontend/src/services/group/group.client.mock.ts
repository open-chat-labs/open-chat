import type { GetMessagesResponse, Message } from "../../domain/chat/chat";
import { fill, randomPara } from "../../utils/mockutils";
import type { IGroupClient } from "./group.client.interface";

const numMessages = 1000;
const interval = 1000 * 60 * 60 * 8; // 8 hours

function mockTextMessage(index: number): Message {
    const now = +new Date();
    const numIntervals = numMessages - index;
    const timeDiff = interval * numIntervals;
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
    };
}

export class GroupClientMock implements IGroupClient {
    chatMessages(fromIndex: number, toIndex: number): Promise<GetMessagesResponse> {
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
}
