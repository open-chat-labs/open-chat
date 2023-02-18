# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Fixed

- Handle the invalid users who joined groups before we had a check in place ([#3162](https://github.com/open-ic/open-chat/pull/3162))

## [[2.0.604](https://github.com/open-ic/open-chat/releases/tag/v2.0.604-group)] - 2023-02-17

### Added

- Added `c2c_initialize_events` for recovering groups which are un-upgradable due to bug in `pre_upgrade` ([#3128](https://github.com/open-ic/open-chat/pull/3128))
- Added `c2c_events_internal` for recovering group events ([#3138](https://github.com/open-ic/open-chat/pull/3138))
- Added `c2c_name_and_members` which is called by the GroupIndex before deleting the group ([#3144](https://github.com/open-ic/open-chat/pull/3144))

### Removed

- Removed code to initialize `proposals_bot_user_id` value ([#3124](https://github.com/open-ic/open-chat/pull/3124))

### Fixed

- Fixed latest message not being returned when getting updates ([#3120](https://github.com/open-ic/open-chat/pull/3120))
- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## [[2.0.589](https://github.com/open-ic/open-chat/releases/tag/v2.0.589-group)] - 2023-02-10

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))
- Drop stable memory after upgrade ([#3116](https://github.com/open-ic/open-chat/pull/3116))

## [[2.0.583](https://github.com/open-ic/open-chat/releases/tag/v2.0.583-group)] - 2023-02-09

### Changed

- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))
- Only allow proposal messages sent by the ProposalsBot ([#3080](https://github.com/open-ic/open-chat/pull/3080))
- Add "claim_prize" to group inspect_message ([#3084](https://github.com/open-ic/open-chat/pull/3084))

## [[2.0.579](https://github.com/open-ic/open-chat/releases/tag/v2.0.579-group)] - 2023-02-06

### Added

- Added transaction details to `PrizeWinnerContent` ([#3055](https://github.com/open-ic/open-chat/pull/3055))

### Changed

- Reduce min interval between cycles balance checks ([#3058](https://github.com/open-ic/open-chat/pull/3058))
- Deserialize using `MemoryManager` within `post_upgrade` ([#3066](https://github.com/open-ic/open-chat/pull/3066))
- Reduce `MemoryManager` bucket size to 1 wasm page ([#3070](https://github.com/open-ic/open-chat/pull/3070))

### Removed

- Removed one-time code to fix incorrect ICP transaction hashes ([#3063](https://github.com/open-ic/open-chat/pull/3063))
- Removed one-time code to migrate `chat_events` to the new format ([#3064](https://github.com/open-ic/open-chat/pull/3064))

## [[2.0.577](https://github.com/open-ic/open-chat/releases/tag/v2.0.577-group)] - 2023-02-03

### Added

- Added `disappears_at` to events ([#3021](https://github.com/open-ic/open-chat/pull/3021))
- Support disappearing messages ([#3029](https://github.com/open-ic/open-chat/pull/3029))
- Added support for "prize" messages ([#3044](https://github.com/open-ic/open-chat/pull/3044))

### Changed

- Refactor and simplify `chat_events` ([#3013](https://github.com/open-ic/open-chat/pull/3013))
- Mark group as active after ending a poll ([#3017](https://github.com/open-ic/open-chat/pull/3017))
- Renamed `disappears_at` to `expires_at` ([#3023](https://github.com/open-ic/open-chat/pull/3023))
- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))

### Fixed

- One time job to fix incorrect ICP transaction hashes ([#3035](https://github.com/open-ic/open-chat/pull/3035))
- Fix 'double borrowing' error when hard deleting files ([#3051](https://github.com/open-ic/open-chat/pull/3051))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))
- Removed `events_range` ([#3011](https://github.com/open-ic/open-chat/pull/3011))

## [[2.0.552](https://github.com/open-ic/open-chat/releases/tag/v2.0.552-group)] - 2023-01-20

### Added

- Add SNS1 token to backend ([#2975](https://github.com/open-ic/open-chat/pull/2975))
- Add ckBTC token to backend ([#2981](https://github.com/open-ic/open-chat/pull/2981))

### Changed

- Skip processing notifications with no recipients ([#2979](https://github.com/open-ic/open-chat/pull/2979))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))

### Removed

- Removed `join_group_v2` which has been superseded by the new `join_group` ([#2966](https://github.com/open-ic/open-chat/pull/2966))

## [[2.0.546](https://github.com/open-ic/open-chat/releases/tag/v2.0.546-group)] - 2023-01-08

### Added

- Allow admins and senders to see deleted message content ([#2922](https://github.com/open-ic/open-chat/pull/2922))

### Changed

- Added `max_messages` to `events` and `events_window` ([#2947](https://github.com/open-ic/open-chat/pull/2947))

### Removed

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-ic/open-chat/pull/2954))
