# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Added `set_message_reminder` ([#3417](https://github.com/open-ic/open-chat/pull/3417))
- Implement 'Gated Groups' ([#3406](https://github.com/open-ic/open-chat/pull/3406))

### Changed

- Simplify how we make calls to the SNS governance canister ([#3405](https://github.com/open-ic/open-chat/pull/3405))
- Store `diamond_membership_expires_at` in each user canister ([#3428](https://github.com/open-ic/open-chat/pull/3428))
- Send message reminders as private replies ([#3431](https://github.com/open-ic/open-chat/pull/3431))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-ic/open-chat/pull/3375))
- Removed `affected_events` which has been superseded by `updated_events` ([#3419](https://github.com/open-ic/open-chat/pull/3419))

## [[2.0.645](https://github.com/open-ic/open-chat/releases/tag/v2.0.645-user)] - 2023-03-25

### Added

- Store and use last updated timestamp on each event ([#3326](https://github.com/open-ic/open-chat/pull/3326))
- Added `timestamp` to `EventsResponse` ([#3329](https://github.com/open-ic/open-chat/pull/3329))

### Changed

- Update group chat summary cache in small batches ([#3341](https://github.com/open-ic/open-chat/pull/3341))
- Don't allow platform moderators to be removed from a group ([#3340](https://github.com/open-ic/open-chat/pull/3340))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-ic/open-chat/pull/3248)) & ([#3251](https://github.com/open-ic/open-chat/pull/3251))
- Removed unused timer job type (`RetrySendingFailedMessage`) ([#3263](https://github.com/open-ic/open-chat/pull/3263))
- Removed `affected_events` from event responses ([#3322](https://github.com/open-ic/open-chat/pull/3322))
- Removed super_admin role from groups([#3319](https://github.com/open-ic/open-chat/pull/3319))
- Remove owner_id from group summary ([#3340](https://github.com/open-ic/open-chat/pull/3340))

### Fixed

- Fix threads incorrectly appearing unread ([#3351](https://github.com/open-ic/open-chat/pull/3351))

## [[2.0.622](https://github.com/open-ic/open-chat/releases/tag/v2.0.622-user)] - 2023-03-01

### Added

- Add CHAT ledger to user and group canisters ([#3222](https://github.com/open-ic/open-chat/pull/3222))
- Added `hot_group_exclusions` ([#3246](https://github.com/open-ic/open-chat/pull/3246))

### Fixed

- Rejoin 'Feature Requests' group if user was a member before it was reinstalled ([#3163](https://github.com/open-ic/open-chat/pull/3163))

## [[2.0.596](https://github.com/open-ic/open-chat/releases/tag/v2.0.596-user)] - 2023-02-16

### Changed

- Stop using `MemoryManager` during `post_upgrade` ([#3130](https://github.com/open-ic/open-chat/pull/3130))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## [[2.0.593](https://github.com/open-ic/open-chat/releases/tag/v2.0.593-user)] - 2023-02-11

### Changed

- Reduce min interval between cycles balance checks ([#3058](https://github.com/open-ic/open-chat/pull/3058))
- Deserialize using `MemoryManager` within `post_upgrade` ([#3066](https://github.com/open-ic/open-chat/pull/3066))
- Reduce `MemoryManager` bucket size to 1 wasm page ([#3070](https://github.com/open-ic/open-chat/pull/3070))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))
- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))
- Drop stable memory after upgrade ([#3116](https://github.com/open-ic/open-chat/pull/3116))
- Temporarily stop using `MemoryManager` during `pre_upgrade` ([#3122](https://github.com/open-ic/open-chat/pull/3122))

### Removed

- Removed one-time code to fix incorrect ICP transaction hashes ([#3063](https://github.com/open-ic/open-chat/pull/3063))
- Removed one-time code to migrate `chat_events` to the new format ([#3064](https://github.com/open-ic/open-chat/pull/3064))

### Fixed

- Fixed latest message not being returned when getting updates ([#3120](https://github.com/open-ic/open-chat/pull/3120))

## [[2.0.578](https://github.com/open-ic/open-chat/releases/tag/v2.0.578-user)] - 2023-02-04

### Added

- Added `disappears_at` to events ([#3021](https://github.com/open-ic/open-chat/pull/3021))
- Support disappearing messages ([#3029](https://github.com/open-ic/open-chat/pull/3029))
- Added support for "prize" messages ([#3044](https://github.com/open-ic/open-chat/pull/3044))

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
