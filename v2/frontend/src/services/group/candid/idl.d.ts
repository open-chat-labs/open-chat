import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    Message,
    UserId,
    ReplyContext,
    MessageContent,
    FileContent,
    TextContent,
    MediaContent,
    TimestampMillis,
    BlobReference,
    EventIndex,
    EventWrapper,
    EventsByIndexArgs,
    EventsByIndexResponse,
    EventsResponse,
    EventsSuccessResult,
    EventsArgs,
    GroupChatEvent,
} from "./types";
export {
    _SERVICE as GroupService,
    Message as ApiMessage,
    UserId as ApiUserId,
    ReplyContext as ApiReplyContext,
    MessageContent as ApiMessageContent,
    FileContent as ApiFileContent,
    TextContent as ApiTextContent,
    MediaContent as ApiMediaContent,
    TimestampMillis as ApiTimestampMillis,
    BlobReference as ApiBlobReference,
    EventIndex as ApiEventIndex,
    EventWrapper as ApiEventWrapper,
    EventsByIndexArgs as ApiEventsByIndexArgs,
    EventsByIndexResponse as ApiEventsByIndexResponse,
    EventsResponse as ApiEventsResponse,
    EventsSuccessResult as ApiEventsSuccessResult,
    EventsArgs as ApiEventsArgs,
    GroupChatEvent as ApiGroupChatEvent,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
