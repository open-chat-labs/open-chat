import type {
    AddParticipantsResponse,
    EventsResponse,
    EventWrapper,
    GroupChatEvent,
    GroupChatReplyContext,
    GroupMessage,
    ChangeAdminResponse,
    SendMessageResponse,
    RemoveParticipantResponse,
    MessageIndexRange,
    MarkReadResponse,
    UpdateGroupResponse,
} from "../../domain/chat/chat";
import { newMessageId } from "../../domain/chat/chat.utils";
import type { BlobReference } from "../../domain/data/data";
import { fill, randomNum, randomPara } from "../../utils/mockutils";
import type { IGroupClient } from "./group.client.interface";

export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

function mockRepliesTo(index: number): GroupChatReplyContext {
    const jumpTo = randomNum(index - 100, index - 1);
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    return {
        kind: "group_reply_context",
        content: {
            kind: "text_content",
            text: randomPara(),
        },
        userId: sender,
        eventIndex: jumpTo,
        messageId: newMessageId(),
    };
}

const now = +new Date();

function mockEvent(index: number): EventWrapper<GroupChatEvent> {
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

function mockImageMessage(index: number): GroupMessage {
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    const sender = index % 3 === 0 ? "abcdefg" : "qwxyz";
    return {
        kind: "group_message",
        content: {
            kind: "image_content",
            caption: "A picture of a bird",
            height: 201,
            width: 250,
            mimeType: "image/jpeg",
            blobReference: {
                blobId: BigInt(0),
                canisterId: "doesnt_matter",
            },
            thumbnailData: "",
        },
        sender,
        repliesTo,
        messageId: newMessageId(),
        messageIndex: index,
    };
}

function mockTextMessage(index: number): GroupMessage {
    const sender = index % 4 === 0 ? "abcdefg" : "qwxyz";
    const repliesTo = index % 10 === 0 && index > 100 ? mockRepliesTo(index) : undefined;
    return {
        kind: "group_message",
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
    chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse<GroupChatEvent>> {
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

    addParticipants(_userIds: string[]): Promise<AddParticipantsResponse> {
        return Promise.resolve({
            kind: "add_participants_success",
        });
    }

    sendMessage(_senderName: string, message: GroupMessage): Promise<SendMessageResponse> {
        return Promise.resolve({
            kind: "send_message_success",
            timestamp: BigInt(Number(+new Date())),
            messageIndex: message.messageIndex,
            eventIndex: message.messageIndex,
        });
    }

    makeAdmin(_userId: string): Promise<ChangeAdminResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 300);
        });
    }

    dismissAsAdmin(_userId: string): Promise<ChangeAdminResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 300);
        });
    }

    removeParticipant(_userId: string): Promise<RemoveParticipantResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 300);
        });
    }

    markMessagesRead(_ranges: MessageIndexRange[]): Promise<MarkReadResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 300);
        });
    }

    updateGroup(_name: string, _desc: string, _avatar?: Uint8Array): Promise<UpdateGroupResponse> {
        return new Promise((res) => {
            setTimeout(() => {
                res("success");
            }, 300);
        });
    }
}
