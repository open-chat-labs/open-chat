# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Push events for mint, burn and treasury transactions ([#5435](https://github.com/open-chat-labs/open-chat/pull/5435))

### Changed

- Update `EventSinkClient` to latest version ([#5431](https://github.com/open-chat-labs/open-chat/pull/5431))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Add `local_user/group_index` canisters to `push_events_whitelist` ([#5459](https://github.com/open-chat-labs/open-chat/pull/5459))

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
