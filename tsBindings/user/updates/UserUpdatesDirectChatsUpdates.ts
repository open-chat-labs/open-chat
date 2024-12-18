// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChatId } from "../../shared/ChatId";
import type { DirectChatSummary } from "../../shared/DirectChatSummary";
import type { DirectChatSummaryUpdates } from "../../shared/DirectChatSummaryUpdates";

export type UserUpdatesDirectChatsUpdates = { added: Array<DirectChatSummary>, updated: Array<DirectChatSummaryUpdates>, removed: Array<ChatId>, pinned?: Array<ChatId> | undefined, };
