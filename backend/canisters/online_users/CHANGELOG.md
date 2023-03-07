# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.599](https://github.com/open-ic/open-chat/releases/tag/v2.0.599-online_users)] - 2023-02-17

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))

## [[2.0.569](https://github.com/open-ic/open-chat/releases/tag/v2.0.569-online_users)] - 2023-02-01

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))

## [[2.0.561](https://github.com/open-ic/open-chat/releases/tag/v2.0.561-online_users)] - 2023-01-23

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))
