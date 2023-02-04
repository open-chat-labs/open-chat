# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Reduce min interval between cycles balance checks ([#3058](https://github.com/open-ic/open-chat/pull/3058))

## [[2.0.578](https://github.com/open-ic/open-chat/releases/tag/v2.0.578-user)] - 2023-02-04

### Added

- Added `disappears_at` to events ([#3021](https://github.com/open-ic/open-chat/pull/3021)) (website must be released first)
- Support disappearing messages ([#3029](https://github.com/open-ic/open-chat/pull/3029)) (website must be released first)
- Added support for "prize" messages ([#3044](https://github.com/open-ic/open-chat/pull/3044)) (group must be released first)

### Changed

- Refactor and simplify `chat_events` ([#3013](https://github.com/open-ic/open-chat/pull/3013))
- Renamed `disappears_at` to `expires_at` ([#3023](https://github.com/open-ic/open-chat/pull/3023))
- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))
- Increase pinned chats limit ([#2998](https://github.com/open-ic/open-chat/pull/2998))

### Fixed

- One time job to fix incorrect ICP transaction hashes ([#3035](https://github.com/open-ic/open-chat/pull/3035))
- Fix 'double borrowing' error when hard deleting files ([#3051](https://github.com/open-ic/open-chat/pull/3051))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))
- Removed `c2c_send_message` ([#3005](https://github.com/open-ic/open-chat/pull/3005))
- Removed `events_range` ([#3011](https://github.com/open-ic/open-chat/pull/3011))
- Remove one time fix to user date created ([#2994](https://github.com/open-ic/open-chat/pull/2994))

## [[2.0.555](https://github.com/open-ic/open-chat/releases/tag/v2.0.555-user)] - 2023-01-20

### Fixed

- Fix bug sending messages from canisters on v2.0.547 to canisters on version v2.0.553 and resend failed messages ([#2995](https://github.com/open-ic/open-chat/pull/2995))

## [[2.0.553](https://github.com/open-ic/open-chat/releases/tag/v2.0.553-user)] - 2023-01-20

### Added

- Add SNS1 token to backend ([#2975](https://github.com/open-ic/open-chat/pull/2975))
- Add ckBTC token to backend ([#2981](https://github.com/open-ic/open-chat/pull/2981))
- Support for assigning nicknames to other users ([#2982](https://github.com/open-ic/open-chat/pull/2982))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))
- Ensure direct messages are received by the recipient's canister in the same order they were received by the sender's canister, even if some fail to be sent c2c on first attempt ([#2986](https://github.com/open-ic/open-chat/pull/2986))
- Use timestamp in nanos not ms for ICRC1 Transfers ([#2988](https://github.com/open-ic/open-chat/pull/2988))
 
### Removed

- Removed `join_group` since this is now handled via the `local_user_index` canister ([#2966](https://github.com/open-ic/open-chat/pull/2966))

## [[2.0.547](https://github.com/open-ic/open-chat/releases/tag/v2.0.547-user)] - 2023-01-08

### Added

- Added `UserJoinedGroup` event type for supporting the new `join_group` flow ([#2955](https://github.com/open-ic/open-chat/pull/2955))
- Added `c2c_notify_events` which deprecates `c2c_notify_user_events` ([#2955](https://github.com/open-ic/open-chat/pull/2955))
- Allow admins and senders to see deleted message content ([#2922](https://github.com/open-ic/open-chat/pull/2922))

### Changed

- Added `max_messages` to `events` and `events_window` ([#2947](https://github.com/open-ic/open-chat/pull/2947))

### Removed 

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-ic/open-chat/pull/2954))
