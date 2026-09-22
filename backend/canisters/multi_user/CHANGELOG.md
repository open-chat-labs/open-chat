# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add the MultiUser canister skeleton with its lifecycle endpoints ([#9310](https://github.com/open-chat-labs/open-chat/pull/9310))
- Initialise the stable memory map, alongside a second map with 256 byte pages for small entries ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))
- Add an unimplemented stub for every User canister endpoint, sharing the User canister's API types ([#9400](https://github.com/open-chat-labs/open-chat/pull/9400))
- Add the `Users` collection and per-user `User` state, `c2c_create_user` for the LocalUserIndex to add a user, and implement `bio` ([#9407](https://github.com/open-chat-labs/open-chat/pull/9407))
- Implement `send_message_v2`, `events`, `events_by_index`, `events_window` and `delete_direct_chat` for direct chats between users in the same canister, with the two users sharing one copy of the chat's events, plus `direct_chat_cores` and `stable_memory_keys_to_garbage_collect` metrics ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Hold each user's direct chats as `DirectChatEntry`s made by the `DirectChatCores` alongside their cores ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Check the thread root before pushing a message and let a user who got a chat back read the threads under the roots they can see ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Leave the threads under the messages a user cannot see out of their summary updates ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Return an error rather than trapping for messages with transfers and recipients in other canisters, until they are supported ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Implement `initial_state` and `updates` for a user's direct chats, alongside `mark_read`, `mute_notifications`, `unmute_notifications`, `archive_unarchive_chats`, `pin_chat_v2` and `unpin_chat_v2`, and report deleted chats through `updates` ([#9413](https://github.com/open-chat-labs/open-chat/pull/9413))
- Return an error rather than trapping when `delete_direct_chat` is asked to block the user, until blocking is supported ([#9413](https://github.com/open-chat-labs/open-chat/pull/9413))
- Hold each user's avatar, profile background, blocked users, contacts, favourite chats and wallet config, and report them through `initial_state` and `updates` ([#9414](https://github.com/open-chat-labs/open-chat/pull/9414))
- Implement `set_avatar`, `set_profile_background`, `set_bio`, `block_user`, `unblock_user`, `set_contact`, `contacts`, `manage_favourite_chats`, `configure_wallet` and `public_profile` ([#9414](https://github.com/open-chat-labs/open-chat/pull/9414))
- Support pinning favourite chats, blocking the other user when deleting a direct chat, and reject messages to users the sender has blocked ([#9414](https://github.com/open-chat-labs/open-chat/pull/9414))
- Implement `edit_message_v2`, `delete_messages`, `undelete_messages`, `add_reaction`, `remove_reaction`, `deleted_message` and `messages_by_message_index` for direct chats between users in the same canister, applying each change to both copies of the chat, plus a timer job to hard delete deleted message content, which undeleting a message cancels, and a `timer_jobs` metric ([#9430](https://github.com/open-chat-labs/open-chat/pull/9430))
- Implement `search_messages`, `update_chat_settings` (disappearing messages, with a per-user job to remove expired events), `message_activity_feed` and `mark_message_activity_feed_read`, recording reactions in the message sender's activity feed and reporting the feed's summary through `initial_state` and `updates` ([#9433](https://github.com/open-chat-labs/open-chat/pull/9433))
- Implement `local_user_index`, `saved_crypto_accounts`, `save_crypto_account`, `delete_saved_crypto_account`, `hot_group_exclusions`, `add_hot_group_exclusions`, `add_recommended_group_exclusions` and `set_pin_number`, holding each user's saved crypto accounts, hot group exclusions and PIN number, and report the PIN number settings through `initial_state` and `updates` ([#9434](https://github.com/open-chat-labs/open-chat/pull/9434))
- Send events to the LocalUserIndex over a queue, each naming the user it is from: notifications of direct messages, and blocking, unblocking and setting a profile background ([#9435](https://github.com/open-chat-labs/open-chat/pull/9435))
- Hold CHIT, the daily claim streak and achievements per user, implementing `claim_daily_chit`, `chit_events` and `mark_achievements_seen`, awarding achievements as the User canister does, and telling the LocalUserIndex of each user's CHIT ([#9438](https://github.com/open-chat-labs/open-chat/pull/9438))
- Send messages from the OpenChat bot to each user's chat with it, and implement `set_message_reminder_v2` and `cancel_message_reminder`, with a timer job which sends each reminder, plus the OpenChat bot's message when streak insurance is claimed ([#9439](https://github.com/open-chat-labs/open-chat/pull/9439))
- Implement `c2c_game_chit` and `c2c_set_user_suspended`, holding each user's game CHIT keys ([#9440](https://github.com/open-chat-labs/open-chat/pull/9440))
- Implement `pay_for_streak_insurance`, paying from the user's subaccount of the canister or an approved account, and the per-user job which uses up a day of streak insurance or resets it when a streak ends ([#9441](https://github.com/open-chat-labs/open-chat/pull/9441))
- Hold each user's groups and communities: implement `create_group`, `create_community`, `leave_group`, `leave_community`, `delete_group`, `delete_community`, `set_community_indexes`, `c2c_group_canister`, `c2c_community_canister`, `c2c_remove_from_group`, `c2c_remove_from_community`, `c2c_notify_group_deleted`, `c2c_notify_community_deleted`, `c2c_groups_and_communities` and the join and Diamond membership events of `c2c_local_user_index`, and include groups and channels in `initial_state`, `updates`, pinning, archiving and `mark_read` ([#9450](https://github.com/open-chat-labs/open-chat/pull/9450))
- Add `c2c_delete_user` for the LocalUserIndex to delete a single user, removing their timer jobs and garbage collecting all of their stable memory map entries ([#9451](https://github.com/open-chat-labs/open-chat/pull/9451))
- Replace `c2c_group_canister`, `c2c_community_canister` and `c2c_local_user_index` with `c2c_group_canister_v2`, `c2c_community_canister_v2` and `c2c_local_user_index_v2`, which take each event paired with the user it is for, so that one call can carry the events for many users ([#9452](https://github.com/open-chat-labs/open-chat/pull/9452))
- Implement `c2c_user_canister_v2`, applying direct chat events from users in other canisters: messages, edits, deletions, reactions, messages read and disappearing message settings ([#9457](https://github.com/open-chat-labs/open-chat/pull/9457))
- Send direct chat events to users in other canisters via their `c2c_user_canister_v2`, looking up recipients the sender has no chat with in the LocalUserIndex: messages, edits, deletions, reactions, messages read and disappearing message settings ([#9458](https://github.com/open-chat-labs/open-chat/pull/9458))
- Hold each user's phone verification, storage limit, unique person proof, external achievements and referrals, applying the `PhoneNumberConfirmed`, `StorageUpgraded`, `ReferredUserRegistered`, `OpenChatBotMessageV2`, `NotifyUniquePersonProof`, `ExternalAchievementAwarded` and `ReinstateMissedDailyClaims` events with their OpenChat bot messages, telling a user's referrer when they reach Diamond or prove personhood, and applying `SetReferralStatus` from referred users, as the User canister does ([#9464](https://github.com/open-chat-labs/open-chat/pull/9464))
- Implement `c2c_grant_super_admin`, `c2c_revoke_super_admin`, `c2c_pay_for_premium_item`, `c2c_notify_achievement` and `report_message`, sharing their logic with the User canister via `user_core` ([#9477](https://github.com/open-chat-labs/open-chat/pull/9477))

### Changed

- Update `ic-stable-structures` to a fork which supports choosing the page size of a map ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))
- Route stable memory map entries by key type to either the main map or the map for small entries ([#9348](https://github.com/open-chat-labs/open-chat/pull/9348))
- Prefix every stable memory map key with the index of the user it belongs to, applied at the boundary of the map so the key types are unchanged ([#9406](https://github.com/open-chat-labs/open-chat/pull/9406))
- Take the GroupIndex, Identity and Escrow canister ids and the video call operators in the init args, and include the user count in the metrics ([#9407](https://github.com/open-chat-labs/open-chat/pull/9407))
- Give each user their own copy of a direct chat, as in the User canister, rather than the two users sharing one copy of its events, and deliver messages and read receipts between the copies of two users in the same canister directly ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
- Drop messages and read receipts from a user the recipient has blocked on the recipient's side, as between User canisters, so a chat deleted by one user is unaffected on the other's side and comes back as a fresh copy when they are messaged again ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
- Garbage collect a deleted chat's stable memory entries within the scope of the user who deleted it, and remove the `direct_chat_cores` metric ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
- Rename the `caller_is_owner` guards to `caller_is_hosted_user`, since the canister hosts many users ([#9432](https://github.com/open-chat-labs/open-chat/pull/9432))
- Verify the caller of `c2c_user_canister_v2` once per call rather than each sender, by asking the LocalUserIndex, which must be upgraded first, caching the MultiUser canisters it confirms, and skip events from blocked senders ([#9459](https://github.com/open-chat-labs/open-chat/pull/9459))
- Move `User` into the `user_state` library, shared with the User canister ([#9467](https://github.com/open-chat-labs/open-chat/pull/9467))
- Build `initial_state` and `updates` from the shared `User`, as the User canister does, so they now include the user's bots ([#9469](https://github.com/open-chat-labs/open-chat/pull/9469))
- Rename the `user_state` library to `user_core`, with the state under `model` and one module per shared endpoint under `queries` and `updates` ([#9470](https://github.com/open-chat-labs/open-chat/pull/9470))
- Take the texts of the OpenChat bot's messages from `user_core`, shared with the User canister ([#9471](https://github.com/open-chat-labs/open-chat/pull/9471))
- Validate `create_group` and `create_community` via `user_core`, shared with the User canister ([#9472](https://github.com/open-chat-labs/open-chat/pull/9472))
- Implement `archive_unarchive_chats`, `pin_chat_v2`, `unpin_chat_v2`, `set_contact`, `public_profile`, `contacts`, `chit_events`, `deleted_message` and `messages_by_message_index` via `user_core`, shared with the User canister ([#9473](https://github.com/open-chat-labs/open-chat/pull/9473))
- Implement the `events`, `events_window` and `events_by_index` queries via `user_core`, shared with the User canister ([#9474](https://github.com/open-chat-labs/open-chat/pull/9474))
- Implement `hot_group_exclusions`, `message_activity_feed`, `c2c_groups_and_communities`, `mute_notifications`, `save_crypto_account`, `add_hot_group_exclusions`, `set_community_indexes` and `c2c_set_user_suspended` via `user_core`, shared with the User canister ([#9475](https://github.com/open-chat-labs/open-chat/pull/9475))

