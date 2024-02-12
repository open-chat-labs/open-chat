# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1053](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1053-online_users)] - 2024-02-09

### Added

- Push `user_online` events to the `event_relay` canister ([#5337](https://github.com/open-chat-labs/open-chat/pull/5337))

### Changed

- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))

## [[2.0.982](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.982-online_users)] - 2023-12-19

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))

## [[2.0.901](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.901-online_users)] - 2023-10-20

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))
- Maintain last online dates during `MemoryManager` reset ([#4622](https://github.com/open-chat-labs/open-chat/pull/4622)) 

## [[2.0.652](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.652-online_users)] - 2023-03-30

### Changed

- Expose active user counts in metrics ([#3390](https://github.com/open-chat-labs/open-chat/pull/3390))

## [[2.0.599](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.599-online_users)] - 2023-02-17

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))

## [[2.0.569](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.569-online_users)] - 2023-02-01

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))

## [[2.0.561](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.561-online_users)] - 2023-01-23

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))
