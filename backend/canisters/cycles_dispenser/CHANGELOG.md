# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

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
