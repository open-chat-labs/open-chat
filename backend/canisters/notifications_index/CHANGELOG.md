# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1614](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1614-notifications_index)] - 2025-02-28

### Added

- Introduce `IdempotencyChecker` in preparation for using best-effort calls ([#7457](https://github.com/open-chat-labs/open-chat/pull/7457))
- Introduce new idempotent endpoints for C2C calls ([#7492](https://github.com/open-chat-labs/open-chat/pull/7492))

### Changed

- Introduce `StableMemoryMap` trait to simplify storing in stable memory ([#7176](https://github.com/open-chat-labs/open-chat/pull/7176))
- Use `GroupedTimerJobQueue` to push events to notification canisters ([#7331](https://github.com/open-chat-labs/open-chat/pull/7331))
- Sync blocked users to notification canisters ([#7333](https://github.com/open-chat-labs/open-chat/pull/7333))

## [[2.0.1529](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1529-notifications_index)] - 2024-12-19

### Changed

- Allow Registry to add additional Notifications canisters ([#7072](https://github.com/open-chat-labs/open-chat/pull/7072))

## [[2.0.1518](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1518-notifications_index)] - 2024-12-13

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))
- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))
- Switch to using `PrincipalToStableMemoryMap` ([#7023](https://github.com/open-chat-labs/open-chat/pull/7023))

### Removed

- Remove deprecated candid endpoints ([#6396](https://github.com/open-chat-labs/open-chat/pull/6396))
- Remove the unused `use_for_new_canisters` field from upgrade args ([#6452](https://github.com/open-chat-labs/open-chat/pull/6452))

## [[2.0.1333](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1333-notifications_index)] - 2024-09-06

### Added

- Expose MessagePack versions of NotificationsIndex APIs ([#6318](https://github.com/open-chat-labs/open-chat/pull/6318))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))

## [[2.0.1320](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1320-notifications_index)] - 2024-09-02

### Changed

- Clear old data from the failed upgrades log ([#6062](https://github.com/open-chat-labs/open-chat/pull/6062))
- Ensure NotificationsIndex is only controller before installing a Notifications canister ([#6070](https://github.com/open-chat-labs/open-chat/pull/6070))
- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1219](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1219-notifications_index)] - 2024-07-03

### Changed

- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

### Fixed

- Fix 'out of cycles' check to use new response code ([#5503](https://github.com/open-chat-labs/open-chat/pull/5503))

### Removed

- Remove code to update user principals ([#5808](https://github.com/open-chat-labs/open-chat/pull/5808))

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
