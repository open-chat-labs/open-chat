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
- Implement `search_messages`, `update_chat_settings` (disappearing messages, with a per-user job to remove expired events), `message_activity_feed` and `mark_message_activity_feed_read`, recording reactions in the message sender's activity feed and reporting the feed's summary through `initial_state` and `updates` ([#TODO](https://github.com/open-chat-labs/open-chat/pull/TODO))

### Changed

- Update `ic-stable-structures` to a fork which supports choosing the page size of a map ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))
- Route stable memory map entries by key type to either the main map or the map for small entries ([#9348](https://github.com/open-chat-labs/open-chat/pull/9348))
- Prefix every stable memory map key with the index of the user it belongs to, applied at the boundary of the map so the key types are unchanged ([#9406](https://github.com/open-chat-labs/open-chat/pull/9406))
- Take the GroupIndex, Identity and Escrow canister ids and the video call operators in the init args, and include the user count in the metrics ([#9407](https://github.com/open-chat-labs/open-chat/pull/9407))
- Give each user their own copy of a direct chat, as in the User canister, rather than the two users sharing one copy of its events, and deliver messages and read receipts between the copies of two users in the same canister directly ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
- Drop messages and read receipts from a user the recipient has blocked on the recipient's side, as between User canisters, so a chat deleted by one user is unaffected on the other's side and comes back as a fresh copy when they are messaged again ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
- Garbage collect a deleted chat's stable memory entries within the scope of the user who deleted it, and remove the `direct_chat_cores` metric ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
