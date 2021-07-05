import type { IDL } from "@dfinity/candid";
import UserService, {
  GetChatsRequest,
  GetChatsResponse,
  ChatSummary,
  Message,
  UserId,
  ReplyContext,
  MessageContent,
  FileContent,
  TextContent,
  MediaContent,
  CyclesContent,
  Timestamp,
  BlobReference,
} from "./canister_types";
export {
  UserService,
  GetChatsRequest as ApiGetChatsRequest,
  GetChatsResponse as ApiGetChatsResponse,
  ChatSummary as ApiChatSummary,
  Message as ApiMessage,
  UserId as ApiUserId,
  ReplyContext as ApiReplyContext,
  MessageContent as ApiMessageContent,
  FileContent as ApiFileContent,
  TextContent as ApiTextContent,
  MediaContent as ApiMediaContent,
  CyclesContent as ApiCyclesContent,
  Timestamp as ApiTimestamp,
  BlobReference as ApiBlobReference,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
