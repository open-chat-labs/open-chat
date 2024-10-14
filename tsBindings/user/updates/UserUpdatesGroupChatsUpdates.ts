// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChatId } from "../../shared/ChatId";
import type { UserGroupChatSummary } from "../UserGroupChatSummary";
import type { UserGroupChatSummaryUpdates } from "../UserGroupChatSummaryUpdates";

export type UserUpdatesGroupChatsUpdates = { 
/**
 * @default []
 */
added: Array<UserGroupChatSummary>, 
/**
 * @default []
 */
updated: Array<UserGroupChatSummaryUpdates>, 
/**
 * @default []
 */
removed: Array<ChatId>, pinned?: Array<ChatId> | undefined, };
