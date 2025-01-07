# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1552](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1552-storage_index)] - 2025-01-07

### Changed

- Increase reserved cycles limit of StorageBuckets ([#7147](https://github.com/open-chat-labs/open-chat/pull/7147))

## [[2.0.1546](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1546-storage_index)] - 2025-01-03

### Changed

- Increase reserved cycles limit of StorageBuckets ([#7147](https://github.com/open-chat-labs/open-chat/pull/7147))

## [[2.0.1546](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1546-storage_index)] - 2025-01-03

### Changed

- Increase memory limit of StorageBucket which has reached limit ([#7142](https://github.com/open-chat-labs/open-chat/pull/7142))

## [[2.0.1521](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1521-storage_index)] - 2024-12-16

### Changed

- Update the canister creation fee to 0.5T ([#6700](https://github.com/open-chat-labs/open-chat/pull/6700))
- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))
- Use `GroupedTimerJobQueue` to sync events to storage buckets ([#7045](https://github.com/open-chat-labs/open-chat/pull/7045))
- Include some entropy when choosing the storage bucket for a file ([#7048](https://github.com/open-chat-labs/open-chat/pull/7048))

## [[2.0.1419](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1419-storage_index)] - 2024-10-28

### Added

- Expose MessagePack versions of StorageIndex APIs ([#6318](https://github.com/open-chat-labs/open-chat/pull/6318))
- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))
- Avoid using `heartbeat` to ensure enough active StorageBucket canisters ([#6646](https://github.com/open-chat-labs/open-chat/pull/6646))
- Avoid using `heartbeat` to upgrade StorageBucket canisters ([#6647](https://github.com/open-chat-labs/open-chat/pull/6647))
- Avoid using `heartbeat` to sync events to StorageBucket canisters ([#6649](https://github.com/open-chat-labs/open-chat/pull/6649))

## [[2.0.1324](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1324-storage_index)] - 2024-09-03

### Changed

- Clear old data from the failed upgrades log ([#6062](https://github.com/open-chat-labs/open-chat/pull/6062))
- Ensure StorageIndex is only controller before installing StorageBucket ([#6070](https://github.com/open-chat-labs/open-chat/pull/6070))
- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))
- Top up buckets that are detected to be out of cycles ([#6311](https://github.com/open-chat-labs/open-chat/pull/6311))

## [[2.0.1175](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1175-storage_index)] - 2024-05-16

### Changed

- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))
- Enable rolling storage for all users ([#5802](https://github.com/open-chat-labs/open-chat/pull/5802))

### Fixed

- Fix 'out of cycles' check to use new response code ([#5503](https://github.com/open-chat-labs/open-chat/pull/5503))

## [[2.0.1029](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1029-storage_index)] - 2024-01-25

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))

### Changed

- Better formatting of proposal payloads ([#5115](https://github.com/open-chat-labs/open-chat/pull/5115))
- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))

## [[2.0.983](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.983-storage_index)] - 2023-12-19

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))

## [[2.0.795](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.795-storage_index)] - 2023-08-08

### Changed

- Bump number of cycles required for upgrade ([#4155](https://github.com/open-chat-labs/open-chat/pull/4155))

## [[2.0.720](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.720-storage_index)] - 2023-06-14

### Fixed

- Another fix for topping up StorageBucket canisters ([#3789](https://github.com/open-chat-labs/open-chat/pull/3789))

## [[2.0.718](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.718-storage_index)] - 2023-06-14

### Fixed

- Fix cycles top-ups of storage bucket canisters ([#3782](https://github.com/open-chat-labs/open-chat/pull/3782))

## [[2.0.707](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.707-storage_index)] - 2023-06-01

### Added

- Added missing proposal validation functions ([#3298](https://github.com/open-chat-labs/open-chat/pull/3298))
- Add `git_commit_id` to metrics ([#3691](https://github.com/open-chat-labs/open-chat/pull/3691))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248))
- Removed `set_governance_principals` ([#3301](https://github.com/open-chat-labs/open-chat/pull/3301))

### Fixed

- Fixed guard on `add_bucket_canister` ([#3243](https://github.com/open-chat-labs/open-chat/pull/3243))

## [[2.0.612](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.612-storage_index)] - 2023-02-24

### Added

- Add `user_controllers` to metrics ([#3212](https://github.com/open-chat-labs/open-chat/pull/3212))

### Changed

- Merge OpenStorage into the OpenChat repo ([#3185](https://github.com/open-chat-labs/open-chat/pull/3185))
- Separate `user_controllers` from `governance_principals` ([#3187](https://github.com/open-chat-labs/open-chat/pull/3187))
