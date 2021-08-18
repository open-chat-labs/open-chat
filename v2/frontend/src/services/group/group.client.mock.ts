import type { EventsResponse, EventWrapper, Message, ReplyContext } from "../../domain/chat/chat";
import { newMessageId } from "../../domain/chat/chat.utils";
import { fill, randomNum, randomPara } from "../../utils/mockutils";
import type { IGroupClient } from "./group.client.interface";

export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

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
    const imageMsg = index % 5 === 0;

    if (index === 0) {
        return {
            event: {
                kind: "group_chat_created",
                name: "cat picz",
                description: "Pictures of my favourite cats",
                created_by: "abcdefg",
            },
            index,
            timestamp: BigInt(+new Date(now - index)),
        };
    }
    return {
        event: imageMsg ? mockImageMessage(index) : mockTextMessage(index),
        index: index,
        timestamp: BigInt(+new Date(now - index)),
    };
}

function mockImageMessage(index: number): Message {
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    return {
        kind: "message",
        content: {
            kind: "media_content",
            caption: "A picture of a bird",
            height: 201,
            width: 250,
            mimeType: "image/jpeg",
            blobReference: {
                blobSize: CHUNK_SIZE_BYTES * 2,
                blobId: BigInt(0),
                canisterId: "doesnt_matter",
                chunkSize: CHUNK_SIZE_BYTES,
            },
            blobData: Promise.resolve(undefined),
            thumbnailData: "",
        },
        sender,
        repliesTo,
        messageId: newMessageId(),
        messageIndex: index,
    };
}

function mockTextMessage(index: number): Message {
    const sender = index % 4 === 0 ? "abcdefg" : "qwxyz";
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    return {
        kind: "message",
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        sender,
        repliesTo,
        messageId: newMessageId(),
        messageIndex: index,
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
