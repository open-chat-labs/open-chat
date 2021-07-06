import type { IDL } from "@dfinity/candid";
import UserService, {
  GetChatsArgs,
  GetChatsResponse,
  ChatSummary,
  GroupChatSummary,
  DirectChatSummary,
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
  User,
} from "./canister_types";
export {
  UserService,
  User as ApiUser,
  GetChatsArgs as ApiGetChatsArgs,
  GetChatsResponse as ApiGetChatsResponse,
  ChatSummary as ApiChatSummary,
  GroupChatSummary as ApiGroupChatSummary,
  DirectChatSummary as ApiDirectChatSummary,
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
