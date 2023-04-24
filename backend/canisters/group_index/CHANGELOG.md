# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Removed time limit before frozen groups can be deleted ([#3490](https://github.com/open-ic/open-chat/pull/3490))

## [[2.0.665](https://github.com/open-ic/open-chat/releases/tag/v2.0.665-group_index)] - 2023-04-17

### Added

- Implement 'Gated Groups' ([#3406](https://github.com/open-ic/open-chat/pull/3406))

### Removed

- Removed `c2c_recommended_groups` ([#3412](https://github.com/open-ic/open-chat/pull/3412))

## [[2.0.642](https://github.com/open-ic/open-chat/releases/tag/v2.0.642-group_index)] - 2023-03-24

### Removed

- Remove owner_id from cached groups ([#3340](https://github.com/open-ic/open-chat/pull/3340))

## [[2.0.629](https://github.com/open-ic/open-chat/releases/tag/v2.0.629-group_index)] - 2023-03-13

### Added

- Endpoint for platform ops to set group upgrade concurrency ([#3268](https://github.com/open-ic/open-chat/pull/3268))

### Changed

- Rename is_super_admin to is_platform_operator in c2c_lookup_user ([#3264](https://github.com/open-ic/open-chat/pull/3264)) 

### Removed

- Removed code only needed for previous upgrade ([#3262](https://github.com/open-ic/open-chat/pull/3262))
- Removed `set_governance_principals` ([#3301](https://github.com/open-ic/open-chat/pull/3301))

## [[2.0.624](https://github.com/open-ic/open-chat/releases/tag/v2.0.624-group_index)] - 2023-03-02

### Added

- Add endpoints to add/remove a hot group exclusion ([#3254](https://github.com/open-ic/open-chat/pull/3254))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-ic/open-chat/pull/3248)) & ([#3251](https://github.com/open-ic/open-chat/pull/3251))
- Removed all the code around reinstalling groups ([#3253](https://github.com/open-ic/open-chat/pull/3253))

## [[2.0.617](https://github.com/open-ic/open-chat/releases/tag/v2.0.617-group_index)] - 2023-02-28

### Added

- One time job to delete all frozen groups ([#3228](https://github.com/open-ic/open-chat/pull/3228))

### Changed

- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-ic/open-chat/pull/3158))

## [[2.0.601](https://github.com/open-ic/open-chat/releases/tag/v2.0.601-group_index)] - 2023-02-17

### Added

- Added `reinstall_group` for recovering groups which are un-upgradable due to bug in `pre_upgrade` ([#3128](https://github.com/open-ic/open-chat/pull/3128))
- Added `frozen_groups` to metrics ([#3140](https://github.com/open-ic/open-chat/pull/3140))
- Added `delete_frozen_group` ([£3144](https://github.com/open-ic/open-chat/pull/3144))
- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-ic/open-chat/pull/3145))

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-ic/open-chat/pull/3133))
- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-ic/open-chat/pull/3152))

### Removed

- Removed code to initialize `proposals_bot_user_id` value ([#3124](https://github.com/open-ic/open-chat/pull/3124))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## [[2.0.581](https://github.com/open-ic/open-chat/releases/tag/v2.0.581-group_index)] - 2023-02-09

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-ic/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))
- Pass in the ProposalsBot userId when initializing each LocalGroupIndex ([#3080](https://github.com/open-ic/open-chat/pull/3080))

## [[2.0.571](https://github.com/open-ic/open-chat/releases/tag/v2.0.571-group_index)] - 2023-02-01

### Added

- Added `events_ttl` field to `c2c_create_group` args for setting the 'time to live' for disappearing messages ([#3029](https://github.com/open-ic/open-chat/pull/3029))
- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-ic/open-chat/pull/3038))

# Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))

## [[2.0.556](https://github.com/open-ic/open-chat/releases/tag/v2.0.556-group_index)] - 2023-01-23

### Added

- Expose validation methods for functions that will be called via proposals ([#2990](https://github.com/open-ic/open-chat/pull/2990))

### Changed

- Reduce log level of job started / stopped messages ([#2951](https://github.com/open-ic/open-chat/pull/2951))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))
