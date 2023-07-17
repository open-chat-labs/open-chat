# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Remove dependency on `ic-sns-governance` ([#3965](https://github.com/open-chat-labs/open-chat/pull/3965))

## [[2.0.737](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.737-proposals_bot)] - 2023-07-03

### Changed

- Update status of finished proposals ([#3890](https://github.com/open-chat-labs/open-chat/pull/3890))

## [[2.0.728](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.728-proposals_bot)] - 2023-06-27

### Added

- Add support for channels to proposals_bot ([#3832](https://github.com/open-chat-labs/open-chat/pull/3832))
- Implement `import_proposals_group_into_community` ([#3844](https://github.com/open-chat-labs/open-chat/pull/3844))

## [[2.0.711](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.711-proposals_bot)] - 2023-06-01

### Changed

- Switch over to using `send_message_v2` ([#3603](https://github.com/open-chat-labs/open-chat/pull/3603))

## [[2.0.658](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.658-proposals_bot)] - 2023-04-14

### Changed

- Only retrieve active proposals ([#3369](https://github.com/open-chat-labs/open-chat/pull/3369))

## [[2.0.647](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.647-proposals_bot)] - 2023-03-24

### Fixed

- Call group::change_role using candid ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))

## [[2.0.638](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.638-proposals_bot)] - 2023-03-20

### Added

- Added appoint_admins endpoint callable by proposal ([#3327](https://github.com/open-chat-labs/open-chat/pull/3327))

### Removed

- Removed update_group_details endpoint callable by platform operators ([#3325](https://github.com/open-chat-labs/open-chat/pull/3325))

## [[2.0.637](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.637-proposals_bot)] - 2023-03-17

### Added

- Added missing proposal validation functions ([#3298](https://github.com/open-chat-labs/open-chat/pull/3298))
- Added update_group_details endpoint callable by platform operators ([#3308](https://github.com/open-chat-labs/open-chat/pull/3308))

### Removed

- Removed temp hack only needed for previous upgrade ([#3293](https://github.com/open-chat-labs/open-chat/pull/3293))
- Removed `set_governance_principals` ([#3301](https://github.com/open-chat-labs/open-chat/pull/3301))

## [[2.0.631](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.631-proposals_bot)] - 2023-03-10

### Fixed

- Temp hack to fix error due to duplicate MessageIds ([#3292](https://github.com/open-chat-labs/open-chat/pull/3292))

## [[2.0.627](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.627-proposals_bot)] - 2023-03-09

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248))
- Removed one time code to get payloads for OpenChat proposals ([#3278](https://github.com/open-chat-labs/open-chat/pull/3278))

### Fixed

- Fixed retrieval of SNS proposals ([#3277](https://github.com/open-chat-labs/open-chat/pull/3277))

## [[2.0.621](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.621-proposals_bot)] - 2023-03-01

### Added

- Added `payload_text_rendering` to SNS proposals ([#3175](https://github.com/open-chat-labs/open-chat/pull/3175))
- One time job to add payloads for existing OpenChat proposal messages ([#3224](https://github.com/open-chat-labs/open-chat/pull/3224))

## [[2.0.600](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.600-proposals_bot)] - 2023-02-17

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-chat-labs/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-chat-labs/open-chat/pull/3133))

## [[2.0.576](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.576-proposals_bot)] - 2023-02-01

### Added

- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-chat-labs/open-chat/pull/3038))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))

## [[2.0.562](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.562-proposals_bot)] - 2023-01-23

### Added

- Add `inspect_message` to proposals bot ([#2969](https://github.com/open-chat-labs/open-chat/pull/2969))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))
