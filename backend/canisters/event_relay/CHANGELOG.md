# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Log total instructions consumed at end of upgrade ([#7551](https://github.com/open-chat-labs/open-chat/pull/7551))
- Filter trace level events globally so they are dropped earlier ([#7678](https://github.com/open-chat-labs/open-chat/pull/7678))

## [[2.0.1525](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1525-event_relay)] - 2024-12-19

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))
- Allow Registry to add additional canisters to the allow list ([#7072](https://github.com/open-chat-labs/open-chat/pull/7072))

### Removed

- Remove `push_events_v2` which is no longer used ([#6502](https://github.com/open-chat-labs/open-chat/pull/6502))

## [[2.0.1317](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1317-event_relay)] - 2024-09-02

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1151](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1151-event_relay)] - 2024-04-23

### Changed

- Update `event_store` packages to v0.1.0 ([#5715](https://github.com/open-chat-labs/open-chat/pull/5715))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

## [[2.0.1125](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1125-event_relay)] - 2024-03-28

### Changed

- Update `event_store` packages to latest version ([#5593](https://github.com/open-chat-labs/open-chat/pull/5593))

### Removed

- Remove code to anonymize events since that now happens in the EventStore ([#5602](https://github.com/open-chat-labs/open-chat/pull/5602))

## [[2.0.1110](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1110-event_relay)] - 2024-03-20

### Changed

- Update `event_store` packages to latest version ([#5535](https://github.com/open-chat-labs/open-chat/pull/5535))
- Sync `salt` to EventStore so that anonymized users match ([#5566](https://github.com/open-chat-labs/open-chat/pull/5566))
- Update `event_store` packages to latest version ([#5568](https://github.com/open-chat-labs/open-chat/pull/5568))

### Fixed

- Fix upgrading from previous events format ([#5579](https://github.com/open-chat-labs/open-chat/pull/5579))

## [[2.0.1084](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1084-event_relay)] - 2024-03-01

### Changed

- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Add `local_user/group_index` canisters to `push_events_whitelist` ([#5459](https://github.com/open-chat-labs/open-chat/pull/5459))

## [[2.0.1081](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1081-event_relay)] - 2024-02-27

### Added

- Push events for mint, burn and treasury transactions ([#5435](https://github.com/open-chat-labs/open-chat/pull/5435))

### Changed

- Update `EventSinkClient` to latest version ([#5431](https://github.com/open-chat-labs/open-chat/pull/5431))

## [[2.0.1058](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1058-event_relay)] - 2024-02-13

### Fixed

- One time job to set the `salt` so that events are anonymised ([#5366](https://github.com/open-chat-labs/open-chat/pull/5366))

## [[2.0.1057](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1057-event_relay)] - 2024-02-13

### Changed

- Switch to using `push_many` ([#5364](https://github.com/open-chat-labs/open-chat/pull/5364))

## [[2.0.1052](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1052-event_relay)] - 2024-02-09

### Added

- Forward anonymised events on to the `event_sink` canister ([#5337](https://github.com/open-chat-labs/open-chat/pull/5337))
- Initial commit ([#5334](https://github.com/open-chat-labs/open-chat/pull/5334))
