# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## Added

- Added `c2c_user_principals` for looking up the principals of multiple users at a time ([#3128](https://github.com/open-ic/open-chat/pull/3128))

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
