# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1026](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1026-notifications_index)] - 2024-01-25

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))

### Changed

- Better formatting of proposal payloads ([#5115](https://github.com/open-chat-labs/open-chat/pull/5115))
- Simplify timer jobs + make them more efficient ([#5233](https://github.com/open-chat-labs/open-chat/pull/5233))
- Rename `service_principals` to `governance_principals` in init args ([#5251](https://github.com/open-chat-labs/open-chat/pull/5251))
- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))

## [[2.0.971](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.971-notifications_index)] - 2023-12-12

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Only store up to 10 subscriptions per user ([#4965](https://github.com/open-chat-labs/open-chat/pull/4965))

## [[2.0.899](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.899-notifications_index)] - 2023-10-19

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

## [[2.0.794](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.794-notifications_index)] - 2023-08-08

### Changed

- Bump number of cycles required for upgrade ([#4155](https://github.com/open-chat-labs/open-chat/pull/4155))

## [[2.0.729](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.729-notifications_index)] - 2023-06-27

### Changed

- Reduce a few timer job intervals ([#3515](https://github.com/open-chat-labs/open-chat/pull/3515))

## [[2.0.653](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.653-notifications_index)] - 2023-03-30

### Changed

- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-chat-labs/open-chat/pull/3158))
- Expose `push_service_principals` in metrics ([#3389](https://github.com/open-chat-labs/open-chat/pull/3389))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248))
- Removed `set_governance_principals` ([#3301](https://github.com/open-chat-labs/open-chat/pull/3301))

## [[2.0.597](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.597-notifications_index)] - 2023-02-17

### Added

- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-chat-labs/open-chat/pull/3145))

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-chat-labs/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-chat-labs/open-chat/pull/3133))
- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-chat-labs/open-chat/pull/3152))

## [[2.0.572](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.572-notifications_index)] - 2023-02-01

### Added

- Expose notifications canisters in metrics ([#3007](https://github.com/open-chat-labs/open-chat/pull/3007))
- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-chat-labs/open-chat/pull/3038))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))

## [[2.0.559](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.559-notifications_index)] - 2023-01-23

### Added

- Expose validation methods for functions that will be called via proposals ([#2990](https://github.com/open-chat-labs/open-chat/pull/2990))

### Changed

- Reduce log level of job started / stopped messages ([#2951](https://github.com/open-chat-labs/open-chat/pull/2951))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))

### Removed

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-chat-labs/open-chat/pull/2954))