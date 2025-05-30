# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1756](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1756-notifications)] - 2025-05-21

### Changed

- Handle `SetNotificationPusherPrincipals` events ([#7968](https://github.com/open-chat-labs/open-chat/pull/7968))
- Support autonomous bots without API keys ([#7985](https://github.com/open-chat-labs/open-chat/pull/7985))
- Include the api_gateway with bot notifications ([#8005](https://github.com/open-chat-labs/open-chat/pull/8005))

## [[2.0.1733](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1733-notifications)] - 2025-05-08

### Changed

- Always use LocalUserIndex to authorize pushing notifications ([#7861](https://github.com/open-chat-labs/open-chat/pull/7861))
- Specify data encoding format ([#8004](https://github.com/open-chat-labs/open-chat/pull/8004))

## [[2.0.1674](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1674-notifications)] - 2025-04-02

### Fixed

- Fix `c2c_push_notifications` idempotency check ([#7733](https://github.com/open-chat-labs/open-chat/pull/7733))

## [[2.0.1674](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1674-notifications)] - 2025-04-02

### Added

- Store bot endpoints in notifications canisters ([#7668](https://github.com/open-chat-labs/open-chat/pull/7668))
- Support bot notifications within Notifications canisters ([#7673](https://github.com/open-chat-labs/open-chat/pull/7673))

### Changed

- Log total instructions consumed at end of upgrade ([#7551](https://github.com/open-chat-labs/open-chat/pull/7551))
- Filter trace level events globally so they are dropped earlier ([#7678](https://github.com/open-chat-labs/open-chat/pull/7678))

## [[2.0.1615](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1615-notifications)] - 2025-02-28

### Added

- Introduce `IdempotencyChecker` in preparation for using best-effort calls ([#7457](https://github.com/open-chat-labs/open-chat/pull/7457))
- Introduce new idempotent endpoints for C2C calls ([#7492](https://github.com/open-chat-labs/open-chat/pull/7492))

### Changed

- Add `sender` to notifications to support blocking notifications from blocked users ([#7330](https://github.com/open-chat-labs/open-chat/pull/7330))
- Block notifications from blocked users ([#7333](https://github.com/open-chat-labs/open-chat/pull/7333))

## [[2.0.1519](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1519-notifications)] - 2024-12-13

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))

## [[2.0.1321](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1321-notifications)] - 2024-09-02

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1218](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1218-notifications)] - 2024-07-03

### Changed

- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

## [[2.0.970](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.970-notifications)] - 2023-12-12

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Return 1 MB of notifications per batch ([#4965](https://github.com/open-chat-labs/open-chat/pull/4965))

## [[2.0.898](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.898-notifications)] - 2023-10-19

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

## [[2.0.798](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.798-notifications)] - 2023-08-08

### Added

- Expose counts of principals authorized and blocked in metrics ([#4145](https://github.com/open-chat-labs/open-chat/pull/4145))

### Changed

- More efficient serialization of notifications ([#4134](https://github.com/open-chat-labs/open-chat/pull/4134))

## [[2.0.786](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.786-notifications)] - 2023-08-03

### Changed

- Reset the list of blocked principals ([#4126](https://github.com/open-chat-labs/open-chat/pull/4126))

## [[2.0.754](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.754-notifications)] - 2023-07-20

### Changed

- Use `canister_client` for making all c2c calls ([#3979](https://github.com/open-chat-labs/open-chat/pull/3979))

## [[2.0.730](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.730-notifications)] - 2023-06-27

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
