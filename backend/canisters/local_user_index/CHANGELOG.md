# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Fixed

- Fix group invite messages ([#3543](https://github.com/open-ic/open-chat/pull/3543))

## [[2.0.674](https://github.com/open-ic/open-chat/releases/tag/v2.0.674-local_user_index)] - 2023-04-28

### Added

- Added ability to `report_message` ([#3497](https://github.com/open-ic/open-chat/pull/3497))
- Supports inviting of specific users ([#3499](https://github.com/open-ic/open-chat/pull/3499))

### Changed

- Encapsulate pushing events and starting sync job ([#3452](https://github.com/open-ic/open-chat/pull/3452))
- Reduce a few timer job intervals ([#3515](https://github.com/open-ic/open-chat/pull/3515))
- Pass OpenChat bot messages in user canister init args ([#3517](https://github.com/open-ic/open-chat/pull/3517))

## [[2.0.663](https://github.com/open-ic/open-chat/releases/tag/v2.0.663-local_user_index)] - 2023-04-17

### Added

- Implement 'Gated Groups' ([#3406](https://github.com/open-ic/open-chat/pull/3406))

### Changed

- Store `diamond_membership_expires_at` in each user canister ([#3428](https://github.com/open-ic/open-chat/pull/3428))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-ic/open-chat/pull/3375))

## [[2.0.646](https://github.com/open-ic/open-chat/releases/tag/v2.0.646-local_user_index)] - 2023-03-27

### Changed

- Pass is_platform_moderator to group::c2c_join_group ([#3340](https://github.com/open-ic/open-chat/pull/3340))

### Removed

- Remove owner_id from group summary ([#3340](https://github.com/open-ic/open-chat/pull/3340))

## [[2.0.634](https://github.com/open-ic/open-chat/releases/tag/v2.0.634-local_user_index)] - 2023-03-14

### Added

- Event for setting user upgrade concurrency ([#3268](https://github.com/open-ic/open-chat/pull/3268))
- Added `OpenChatBotMessage` event type ([#3274](https://github.com/open-ic/open-chat/pull/3274))
- Return group summary if user tries to join group they are already in ([#3296](https://github.com/open-ic/open-chat/pull/3296))

### Changed

- Switch to using the new `c2c_notify_events` endpoint ([#3283](https://github.com/open-ic/open-chat/pull/3283))
- Set upgrade concurrency to 10 ([#3302](https://github.com/open-ic/open-chat/pull/3302))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-ic/open-chat/pull/3248))
- Removed super_admin role from groups([#3319](https://github.com/open-ic/open-chat/pull/3319))

## [[2.0.616](https://github.com/open-ic/open-chat/releases/tag/v2.0.616-local_user_index)] - 2023-02-28

### Changed

- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-ic/open-chat/pull/3152))
- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-ic/open-chat/pull/3158))
- Allow both users and user canisters to pass the `is_caller_openchat_user` guard ([#3163](https://github.com/open-ic/open-chat/pull/3163))

## [[2.0.595](https://github.com/open-ic/open-chat/releases/tag/v2.0.595-local_user_index)] - 2023-02-16

### Added

- Added `c2c_user_principals` for looking up the principals of multiple users at a time ([#3128](https://github.com/open-ic/open-chat/pull/3128))
- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-ic/open-chat/pull/3145))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## [[2.0.592](https://github.com/open-ic/open-chat/releases/tag/v2.0.592-local_user_index)] - 2023-02-11

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))
- Drop user canister stable memory after upgrade ([#3116](https://github.com/open-ic/open-chat/pull/3116))

## [[2.0.587](https://github.com/open-ic/open-chat/releases/tag/v2.0.587-local_user_index)] - 2023-02-10

### Added

- Added `DiamondMembershipPaymentReceived` event type ([#3069](https://github.com/open-ic/open-chat/pull/3069))

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-ic/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))

## [[2.0.573](https://github.com/open-ic/open-chat/releases/tag/v2.0.573-local_user_index)] - 2023-02-01

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))
- Remove one time fix to user date created ([#2994](https://github.com/open-ic/open-chat/pull/2994))

## [[2.0.563](https://github.com/open-ic/open-chat/releases/tag/v2.0.563-local_user_index)] - 2023-01-23

### Changed

- Simplify code by using shared `UpgradeCanisterWasmArgs` ([#2990](https://github.com/open-ic/open-chat/pull/2990))

## [[2.0.554](https://github.com/open-ic/open-chat/releases/tag/v2.0.554-local_user_index)] - 2023-01-20

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))

## [[2.0.545](https://github.com/open-ic/open-chat/releases/tag/v2.0.545-local_user_index)] - 2023-01-08

### Added

- Added `join_group` which avoids having to wait for any inter subnet updates ([#2955](https://github.com/open-ic/open-chat/pull/2955))
- Added `c2c_notify_events` which deprecates `c2c_notify_user_index_events` ([#2955](https://github.com/open-ic/open-chat/pull/2955))

### Changed

- Reduce log level of job started / stopped messages ([#2951](https://github.com/open-ic/open-chat/pull/2951))

### Removed

- Removed one-time code only needed for initializing the first local user index ([#2953](https://github.com/open-ic/open-chat/pull/2953))
- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-ic/open-chat/pull/2954))
