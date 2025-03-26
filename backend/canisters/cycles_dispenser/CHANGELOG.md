# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Log total instructions consumed at end of upgrade ([#7551](https://github.com/open-chat-labs/open-chat/pull/7551))

## [[2.0.1550](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1550-cycles_dispenser)] - 2025-01-06

### Changed

- Log message if an unauthorized canister tries to request cycles ([#7163](https://github.com/open-chat-labs/open-chat/pull/7163))

## [[2.0.1527](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1527-cycles_dispenser)] - 2024-12-19

### Changed

- Allow Registry to add additional canisters to the allow list ([#7072](https://github.com/open-chat-labs/open-chat/pull/7072))

## [[2.0.1511](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1511-cycles_dispenser)] - 2024-12-13

### Changed

- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))

### Fixed

- Fix ordering of `latest_top_ups` ([#7046](https://github.com/open-chat-labs/open-chat/pull/7046))

## [[2.0.1485](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1485-cycles_dispenser)] - 2024-11-29

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Simplify `inspect_message` ([#6847](https://github.com/open-chat-labs/open-chat/pull/6847))
- Increase cycles held by CyclesDispenser to handle large spikes in usage ([#6898](https://github.com/open-chat-labs/open-chat/pull/6898))
- Record top-ups of all SNS canisters ([#6900](https://github.com/open-chat-labs/open-chat/pull/6900))

## [[2.0.1315](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1315-cycles_dispenser)] - 2024-09-02

### Changed

- Remove duplicate code ([#5637](https://github.com/open-chat-labs/open-chat/pull/5637))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))
- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1126](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1126-cycles_dispenser)] - 2024-04-05

### Added

- Automatically add SNS controlled canisters to the whitelist ([#5625](https://github.com/open-chat-labs/open-chat/pull/5625))

### Changed

- Top up all canisters registered with the SNS ([#5621](https://github.com/open-chat-labs/open-chat/pull/5621))

## [[2.0.1092](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1092-cycles_dispenser)] - 2024-03-07

### Changed

- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))
- Split `sns_root` into its own package within `external_canisters` ([#5266](https://github.com/open-chat-labs/open-chat/pull/5266))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))

## [[2.0.1017](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1017-cycles_dispenser)] - 2024-01-19

### Changed

- Better formatting of proposal payloads ([#5115](https://github.com/open-chat-labs/open-chat/pull/5115))

## [[2.0.980](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.980-cycles_dispenser)] - 2023-12-19

### Changed

- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))

## [[2.0.920](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.920-cycles_dispenser)] - 2023-11-02

### Added

- Add `latest_top_ups` endpoint ([#4252](https://github.com/open-chat-labs/open-chat/pull/4252))

### Changed

- Switch CyclesDispenser over to using `MemoryManager` ([#4682](https://github.com/open-chat-labs/open-chat/pull/4682))
- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))

## [[2.0.750](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.750-cycles_dispenser)] - 2023-07-20

### Changed

- Call into ICP ledger via the new `icp_ledger_canister_c2c_client` ([#3966](https://github.com/open-chat-labs/open-chat/pull/3966))
- Use `canister_client` for making all c2c calls ([#3979](https://github.com/open-chat-labs/open-chat/pull/3979))

## [[2.0.719](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.719-cycles_dispenser)] - 2023-06-14

### Changed

- Expose `icp_account` in metrics ([#3375](https://github.com/open-chat-labs/open-chat/pull/3728))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-chat-labs/open-chat/pull/3375))

## [[2.0.640](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.640-cycles_dispenser)] - 2023-03-23

### Added

- Top up SNS canisters with cycles automatically ([#3312](https://github.com/open-chat-labs/open-chat/pull/3312))

## [[2.0.635](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.635-cycles_dispenser)] - 2023-03-13

### Added

- Added missing proposal validation functions ([#3298](https://github.com/open-chat-labs/open-chat/pull/3298))

### Removed

- Removed `set_governance_principals` ([#3301](https://github.com/open-chat-labs/open-chat/pull/3301))

## [[2.0.632](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.632-cycles_dispenser)] - 2023-03-10

### Changed

- Added `icp_burn_amount` to `update_config` args ([#3272](https://github.com/open-chat-labs/open-chat/pull/3272))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248))

## [[2.0.611](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.611-cycles_dispenser)] - 2023-02-24

### Changed

- Merge CyclesDispenser into the OpenChat repo ([#3190](https://github.com/open-chat-labs/open-chat/pull/3190))
- Enable tracing when in test mode ([#3211](https://github.com/open-chat-labs/open-chat/pull/3211))
