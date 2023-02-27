# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## Changed

- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-ic/open-chat/pull/3152))
- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-ic/open-chat/pull/3158))
- Upgrade LocalUserIndex canisters using a timer job rather than heartbeat ([#3229](https://github.com/open-ic/open-chat/pull/3229))
- Set users as suspended / unsuspended using a timer job rather than heartbeat ([#3230](https://github.com/open-ic/open-chat/pull/3230))

## Removed

- Remove one time code to set up `GroupUpgradeBot` users  ([#3159](https://github.com/open-ic/open-chat/pull/3159))

## [[2.0.594](https://github.com/open-ic/open-chat/releases/tag/v2.0.594-user_index)] - 2023-02-16

### Added

- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-ic/open-chat/pull/3145))

### Changed

- Registered each LocalGroupIndex as a bot user ([#3128](https://github.com/open-ic/open-chat/pull/3128))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-ic/open-chat/pull/3133))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## [[2.0.590](https://github.com/open-ic/open-chat/releases/tag/v2.0.590-user_index)] - 2023-02-10

### Added

- Diamond metrics ([#3117](https://github.com/open-ic/open-chat/pull/3117))

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))

### Removed

- Removed code for upgrading storage and confirming phone number ([#3110](https://github.com/open-ic/open-chat/pull/3110))
- Removed one time code to sync users to OpenStorage ([#3114](https://github.com/open-ic/open-chat/pull/3114))

## [[2.0.584](https://github.com/open-ic/open-chat/releases/tag/v2.0.584-user_index)] - 2023-02-09

### Changed

- Push all users to OpenStorage with the new storage limits ([#3104](https://github.com/open-ic/open-chat/pull/3104))

### Removed

- Removed code only needed for the previous upgrade ([#3102](https://github.com/open-ic/open-chat/pull/3102))

## [[2.0.580](https://github.com/open-ic/open-chat/releases/tag/v2.0.580-user_index)] - 2023-02-09

### Added

- Added `pay_for_diamond_membership` ([#3069](https://github.com/open-ic/open-chat/pull/3069))

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-ic/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))
- Remove captcha challenge after any attempt ([#3078](https://github.com/open-ic/open-chat/pull/3078))
- Mark user as updated after taking Diamond membership payment ([#3081](https://github.com/open-ic/open-chat/pull/3081))
- Give all verified users 12 months Diamond membership ([#3082](https://github.com/open-ic/open-chat/pull/3082))

### Fixed
- Fix c2c_register_bot so it queues UserRegistered ([#3086](https://github.com/open-ic/open-chat/pull/3086))
- Fix username uniqueness check to include reserved usernames ([#3088](https://github.com/open-ic/open-chat/pull/3088))

## [[2.0.570](https://github.com/open-ic/open-chat/releases/tag/v2.0.570-user_index)] - 2023-02-01

### Added

- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-ic/open-chat/pull/3038))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))

## [[2.0.558](https://github.com/open-ic/open-chat/releases/tag/v2.0.558-user_index)] - 2023-01-23

### Added

- Expose validation methods for functions that will be called via proposals ([#2990](https://github.com/open-ic/open-chat/pull/2990))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))

## [[2.0.544](https://github.com/open-ic/open-chat/releases/tag/v2.0.544-user_index)] - 2023-01-08

### Added

- Added `c2c_notify_events` for receiving events from local user indexes ([#2955](https://github.com/open-ic/open-chat/pull/2955))

### Fixed

- Free up username if registration fails ([#2952](https://github.com/open-ic/open-chat/pull/2952))
