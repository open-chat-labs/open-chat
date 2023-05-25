# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Integrate Communities ([#3656](https://github.com/open-ic/open-chat/pull/3656))

## [[2.0.691](https://github.com/open-ic/open-chat/releases/tag/v2.0.691-local_group_index)] - 2023-05-17

### Changed

- Added `moderator` role ([#3592](https://github.com/open-ic/open-chat/pull/3592))

## [[2.0.664](https://github.com/open-ic/open-chat/releases/tag/v2.0.664-local_group_index)] - 2023-04-17

### Added

- Implement 'Gated Groups' ([#3406](https://github.com/open-ic/open-chat/pull/3406))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-ic/open-chat/pull/3375))

## [[2.0.648](https://github.com/open-ic/open-chat/releases/tag/v2.0.648-local_group_index)] - 2023-02-24

### Added

- C2C endpoint for setting group upgrade concurrency ([#3268](https://github.com/open-ic/open-chat/pull/3268))

### Changed

- Set upgrade concurrency to 10 ([#3302](https://github.com/open-ic/open-chat/pull/3302))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-ic/open-chat/pull/3248))
- Removed all the code around reinstalling groups ([#3253](https://github.com/open-ic/open-chat/pull/3253))

## [[2.0.618](https://github.com/open-ic/open-chat/releases/tag/v2.0.618-local_group_index)] - 2023-02-28

### Added

- Expose metrics about the current group being reinstalled ([#3194](https://github.com/open-ic/open-chat/pull/3194))

### Changed

- Use `c2c_events_internal` when reinstalling groups ([#3216](https://github.com/open-ic/open-chat/pull/3216))

## [[2.0.608](https://github.com/open-ic/open-chat/releases/tag/v2.0.608-local_group_index)] - 2023-02-21

### Changed

- Speed up reinstalling groups by retrieving threads in batches ([#3177](https://github.com/open-ic/open-chat/pull/3177))

## [[2.0.605](https://github.com/open-ic/open-chat/releases/tag/v2.0.605-local_group_index)] - 2023-02-17

### Changed

- Increase batch size of getting events during reinstall ([#3161](https://github.com/open-ic/open-chat/pull/3161))

## [[2.0.603](https://github.com/open-ic/open-chat/releases/tag/v2.0.603-local_group_index)] - 2023-02-17

### Changed

- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-ic/open-chat/pull/3158))

## [[2.0.602](https://github.com/open-ic/open-chat/releases/tag/v2.0.602-local_group_index)] - 2023-02-17

### Added

- Added `c2c_reinstall_group` for recovering groups which are un-upgradable due to bug in `pre_upgrade` ([#3128](https://github.com/open-ic/open-chat/pull/3128))
- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-ic/open-chat/pull/3145))
- Reinstall groups using heartbeat but stop if any fail ([#3154](https://github.com/open-ic/open-chat/pull/3154))

### Changed

- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-ic/open-chat/pull/3152))

### Removed

- Removed code to initialize `proposals_bot_user_id` value ([#3124](https://github.com/open-ic/open-chat/pull/3124))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## [[2.0.588](https://github.com/open-ic/open-chat/releases/tag/v2.0.588-local_group_index)] - 2023-02-10

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))
- Drop group canister stable memory after upgrade ([#3116](https://github.com/open-ic/open-chat/pull/3116))

## [[2.0.582](https://github.com/open-ic/open-chat/releases/tag/v2.0.582-local_group_index)] - 2023-02-09

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-ic/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))
- Pass in the ProposalsBot userId when initializing each Group ([#3080](https://github.com/open-ic/open-chat/pull/3080))

## [[2.0.574](https://github.com/open-ic/open-chat/releases/tag/v2.0.574-local_group_index)] - 2023-02-01

### Added

- Added `events_ttl` field to `c2c_create_group` args for setting the 'time to live' for disappearing messages ([#3029](https://github.com/open-ic/open-chat/pull/3029))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))

## [[2.0.557](https://github.com/open-ic/open-chat/releases/tag/v2.0.557-local_group_index)] - 2023-01-23

### Changed

- Simplify code by using shared `UpgradeCanisterWasmArgs` ([#2990](https://github.com/open-ic/open-chat/pull/2990))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))

### Removed

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-ic/open-chat/pull/2954))
