# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

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
