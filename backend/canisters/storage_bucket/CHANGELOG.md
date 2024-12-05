# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))

## [[2.0.1420](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1420-storage_bucket)] - 2024-10-28

### Added

- Expose MessagePack versions of StorageBucket APIs ([#6318](https://github.com/open-chat-labs/open-chat/pull/6318))
- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))
- Avoid using `heartbeat` to sync events to StorageIndex canister ([#6688](https://github.com/open-chat-labs/open-chat/pull/6688))
- Avoid using `heartbeat` to remove expired files ([#6689](https://github.com/open-chat-labs/open-chat/pull/6689))

## [[2.0.1325](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1325-storage_bucket)] - 2024-09-03

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1206](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1206-storage_bucket)] - 2024-06-19

### Changed

- Add cacheable resource header ([#5947](https://github.com/open-chat-labs/open-chat/pull/5947))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

## [[2.0.1030](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1030-storage_bucket)] - 2024-01-25

### Changed

- Increase StorageBucket size limit to 64GB ([#5249](https://github.com/open-chat-labs/open-chat/pull/5249))

## [[2.0.984](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.984-storage_bucket)] - 2023-12-19

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))

## [[2.0.757](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.757-storage_bucket)] - 2023-07-20

### Changed

- Avoid using `candid::Func` type directly ([#3983](https://github.com/open-chat-labs/open-chat/pull/3983))

## [[2.0.717](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.717-storage_bucket)] - 2023-06-12

### Changed

- Get `freezing_limit` from system in `check_cycles_balance` ([#3767](https://github.com/open-chat-labs/open-chat/pull/3767))

## [[2.0.708](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.708-storage_bucket)] - 2023-06-01

### Added

- Add `git_commit_id` to metrics ([#3691](https://github.com/open-chat-labs/open-chat/pull/3691))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248))

## [[2.0.613](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.613-storage_bucket)] - 2023-02-24

### Changed

- Merge OpenStorage into the OpenChat repo ([#3185](https://github.com/open-chat-labs/open-chat/pull/3185))
