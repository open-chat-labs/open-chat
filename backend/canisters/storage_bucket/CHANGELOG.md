# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add MessagePack versions of canister endpoints ([#7347](https://github.com/open-chat-labs/open-chat/pull/7347))
- Add JSON versions of canister endpoints ([#7374](https://github.com/open-chat-labs/open-chat/pull/7374))

### Changed

- Log total instructions consumed at end of upgrade ([#7551](https://github.com/open-chat-labs/open-chat/pull/7551))
- Make canister logs public ([#7675](https://github.com/open-chat-labs/open-chat/pull/7675))

## [[2.0.1573](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1573-storage_bucket)] - 2025-01-21

### Changed

- Sync heap and stable memory sizes to StorageIndex ([#7192](https://github.com/open-chat-labs/open-chat/pull/7192))
- Simplify handling of file expiration ([#7195](https://github.com/open-chat-labs/open-chat/pull/7195))
- Use macro to create grouped timer job types ([#7224](https://github.com/open-chat-labs/open-chat/pull/7224))

## [[2.0.1560](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1560-storage_bucket)] - 2025-01-09

### Changed

- Clean up after users and files migrated to stable memory ([#7182](https://github.com/open-chat-labs/open-chat/pull/7182))
- Expose expiration queue length in metrics ([#7189](https://github.com/open-chat-labs/open-chat/pull/7189))

## [[2.0.1558](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1558-storage_bucket)] - 2025-01-09

### Changed

- Remove code to migrate users to stable memory ([#7182](https://github.com/open-chat-labs/open-chat/pull/7182))
- Regular job to remove old pending files ([#7183](https://github.com/open-chat-labs/open-chat/pull/7183))
- Revert field name changes until the old fields have been removed ([#7185](https://github.com/open-chat-labs/open-chat/pull/7185))

## [[2.0.1557](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1557-storage_bucket)] - 2025-01-08

### Changed

- Reduce size of users map when serialized ([#7175](https://github.com/open-chat-labs/open-chat/pull/7175))
- Introduce `StableMemoryMap` trait to simplify storing in stable memory ([#7176](https://github.com/open-chat-labs/open-chat/pull/7176))
- Migrate user records to stable memory ([#7178](https://github.com/open-chat-labs/open-chat/pull/7178))

## [[2.0.1555](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1555-storage_bucket)] - 2025-01-07

### Changed

- Remove file data from being stored on the heap ([#7171](https://github.com/open-chat-labs/open-chat/pull/7171))

## [[2.0.1553](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1553-storage_bucket)] - 2025-01-07

### Changed

- Reduce storage bucket memory usage ([#7103](https://github.com/open-chat-labs/open-chat/pull/7103))
- Move file metadata to stable memory ([#7120](https://github.com/open-chat-labs/open-chat/pull/7120))

## [[2.0.1532](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1532-storage_bucket)] - 2024-12-19

### Changed

- Push any remaining events still queued in the old events system ([#7065](https://github.com/open-chat-labs/open-chat/pull/7065))

## [[2.0.1522](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1522-storage_bucket)] - 2024-12-16

### Changed

- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))
- Avoid having to regenerate rng seed after each upgrade ([#7043](https://github.com/open-chat-labs/open-chat/pull/7043))
- Use `GroupedTimerJobQueue` to sync events to storage index ([#7047](https://github.com/open-chat-labs/open-chat/pull/7047))

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
