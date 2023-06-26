# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.730](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.730-notifications)] - 2023-06-TBD

### Changed

- Expose `push_service_principals` in metrics ([#3389](https://github.com/open-chat-labs/open-chat/pull/3389))

## [[2.0.650](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.650-notifications)] - 2023-03-28

### Changed

- Record `timestamp` when notification is created to measure latency ([#3378](https://github.com/open-chat-labs/open-chat/pull/3378))

## [[2.0.598](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.598-notifications)] - 2023-02-17

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-chat-labs/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))

## [[2.0.575](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.575-notifications)] - 2023-02-01

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))

## [[2.0.560](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.560-notifications)] - 2023-01-23

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))
