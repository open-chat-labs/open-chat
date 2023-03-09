# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Fixed

- Temp hack to fix error due to duplicate MessageIds ([#3292](https://github.com/open-ic/open-chat/pull/3292))

## [[2.0.627](https://github.com/open-ic/open-chat/releases/tag/v2.0.627-proposals_bot)] - 2023-03-09

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-ic/open-chat/pull/3248))
- Removed one time code to get payloads for OpenChat proposals ([#3278](https://github.com/open-ic/open-chat/pull/3278))

### Fixed

- Fixed retrieval of SNS proposals ([#3277](https://github.com/open-ic/open-chat/pull/3277))

## [[2.0.621](https://github.com/open-ic/open-chat/releases/tag/v2.0.621-proposals_bot)] - 2023-03-01

### Added

- Added `payload_text_rendering` to SNS proposals ([#3175](https://github.com/open-ic/open-chat/pull/3175))
- One time job to add payloads for existing OpenChat proposal messages ([#3224](https://github.com/open-ic/open-chat/pull/3224))

## [[2.0.600](https://github.com/open-ic/open-chat/releases/tag/v2.0.600-proposals_bot)] - 2023-02-17

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-ic/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))
- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-ic/open-chat/pull/3133))

## [[2.0.576](https://github.com/open-ic/open-chat/releases/tag/v2.0.576-proposals_bot)] - 2023-02-01

### Added

- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-ic/open-chat/pull/3038))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))

## [[2.0.562](https://github.com/open-ic/open-chat/releases/tag/v2.0.562-proposals_bot)] - 2023-01-23

### Added

- Add `inspect_message` to proposals bot ([#2969](https://github.com/open-ic/open-chat/pull/2969))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))
