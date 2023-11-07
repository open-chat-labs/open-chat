# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Rename 'block_index' to 'transaction_index' ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))

## [[2.0.918](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.918-registry)] - 2023-10-30

### Added

- Implement job to update SNS metadata and parameters ([#4674](https://github.com/open-chat-labs/open-chat/pull/4674))

## [[2.0.904](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.904-registry)] - 2023-10-24

### Changed

- Added `index_canister_id` to `NervousSystemSummary` ([#4632](https://github.com/open-chat-labs/open-chat/pull/4632))

## [[2.0.892](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.892-registry)] - 2023-10-19

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

### Fixed

- Set `last_updated` after updating token details ([#4596](https://github.com/open-chat-labs/open-chat/pull/4596))

## [[2.0.885](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.885-registry)] - 2023-10-13

### Changed

- Include `root_canister_id` in `NervousSystemSummary` ([#4573](https://github.com/open-chat-labs/open-chat/pull/4573))

### Removed

- Remove deprecated `nervous_system` field from `TokenDetails` ([#4584](https://github.com/open-chat-labs/open-chat/pull/4584))

## [[2.0.883](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.883-registry)] - 2023-10-12

### Added

- Added `c2c_nervous_systems` ([#4557](https://github.com/open-chat-labs/open-chat/pull/4557))
- Store whether submitting proposals is enabled or not in the Registry ([#4564](https://github.com/open-chat-labs/open-chat/pull/4564))
- Return nervous system details when polling the Registry ([#4565](https://github.com/open-chat-labs/open-chat/pull/4565))

### Changed

- Add `name` and `symbol` to rendering of 'Update token' proposals ([#4167](https://github.com/open-chat-labs/open-chat/pull/4167))
- Store nervous system details in the Registry ([#4555](https://github.com/open-chat-labs/open-chat/pull/4555))

## [[2.0.797](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.797-registry)] - 2023-08-08

### Added

- Automate adding SNS tokens to the registry ([#4124](https://github.com/open-chat-labs/open-chat/pull/4124))

### Changed

- Store root and governance canisters for SNS tokens ([#4001](https://github.com/open-chat-labs/open-chat/pull/4001))
- Rename `sns_canisters` to `nervous_system` ([#4012](https://github.com/open-chat-labs/open-chat/pull/4012))
- Add ICP token details to registry upon init ([#4013](https://github.com/open-chat-labs/open-chat/pull/4013))
- Support updating token name and symbol ([#4128](https://github.com/open-chat-labs/open-chat/pull/4128))

## [[2.0.756](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.756-registry)] - 2023-07-20

### Changed

- Remove dependencies on IC repo ([#3970](https://github.com/open-chat-labs/open-chat/pull/3970))

## [[2.0.739](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.739-registry)] - 2023-07-06

### Changed

- Fetch token logo when adding token to registry ([#3917](https://github.com/open-chat-labs/open-chat/pull/3917))
- Implement `update_token` ([#3921](https://github.com/open-chat-labs/open-chat/pull/3921))
- Give option to manually specify logo in `add_token` ([#3921](https://github.com/open-chat-labs/open-chat/pull/3921))
