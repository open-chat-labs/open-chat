// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ChatId } from "../../shared/ChatId";
import type { UserGroupChatSummary } from "../UserGroupChatSummary";
import type { UserInitialStateCachedGroupChatSummaries } from "./UserInitialStateCachedGroupChatSummaries";

export type UserInitialStateGroupChatsInitial = { summaries: Array<UserGroupChatSummary>, pinned: Array<ChatId>, cached?: UserInitialStateCachedGroupChatSummaries, };