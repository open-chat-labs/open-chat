import type { EventsResponse, EventWrapper, Message, ReplyContext } from "../../domain/chat/chat";
import { fill, randomNum, randomPara } from "../../utils/mockutils";
import type { IGroupClient } from "./group.client.interface";

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

function mockEvent(index: number): EventWrapper {
    return {
        event: mockTextMessage(index),
        index: index,
        timestamp: BigInt(+new Date(now - index)),
    };
}

function mockTextMessage(index: number): Message {
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
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

export class GroupClientMock implements IGroupClient {
    chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse> {
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
}
