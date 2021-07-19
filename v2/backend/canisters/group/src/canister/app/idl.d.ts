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
  GetMessagesArgs,
  GetMessagesResponse,
  GetMessagesSuccess,
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
  GetMessagesArgs as ApiGetMessageArgs,
  GetMessagesResponse as ApiGetMessagesResponse,
  GetMessagesSuccess as ApiGetMessagesSuccess,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
