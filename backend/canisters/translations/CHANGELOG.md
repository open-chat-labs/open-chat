# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add MessagePack versions of canister endpoints ([#7347](https://github.com/open-chat-labs/open-chat/pull/7347))

## [[2.0.1559](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1559-translations)] - 2025-01-09

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Refactor transfers to differentiate between transfers that failed due to c2c error vs transfer error ([#6500](https://github.com/open-chat-labs/open-chat/pull/6500))
- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))

### Fixed

- Use composite query to authorize caller via UserIndex ([#7187](https://github.com/open-chat-labs/open-chat/pull/7187))

## [[2.0.1326](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1326-translations)] - 2024-09-03

### Changed

- Fix fee then retry transfer if fee too high ([#6063](https://github.com/open-chat-labs/open-chat/pull/6063))
- Handle transfer fee changing in either direction ([#6064](https://github.com/open-chat-labs/open-chat/pull/6064))
- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1220](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1220-translations)] - 2024-07-03

### Changed

- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))
- Don't retry c2c calls after getting a `DestinationInvalid` error ([#5732](https://github.com/open-chat-labs/open-chat/pull/5732))
- Don't retry c2c calls after getting a `CanisterMethodNotFound` error ([#5747](https://github.com/open-chat-labs/open-chat/pull/5747))

## [[2.0.1068](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1068-translations)] - 2024-02-21

### Fixed

- Use slightly different timestamps to avoid duplicates ([#5392](https://github.com/open-chat-labs/open-chat/pull/5392))

## [[2.0.1067](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1067-translations)] - 2024-02-16

### Fixed

- Specify `created_at_time` in nanoseconds rather than milliseconds ([#5391](https://github.com/open-chat-labs/open-chat/pull/5391))

## [[2.0.1066](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1066-translations)] - 2024-02-16

### Fixed

- Resend translation payments which failed due to being too old ([#5388](https://github.com/open-chat-labs/open-chat/pull/5388))

## [[2.0.1064](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1064-translations)] - 2024-02-05

### Fixed

- Start job to make pending payments each time a payment is added ([#5379](https://github.com/open-chat-labs/open-chat/pull/5379))
- Trim proposed translations ([#5381](https://github.com/open-chat-labs/open-chat/pull/5381))

## [[2.0.1045](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1045-translations)] - 2024-02-05

### Added

- Implement translations API ([#5299](https://github.com/open-chat-labs/open-chat/pull/5299))
- Send periodic OC bot messages to translators ([#5318](https://github.com/open-chat-labs/open-chat/pull/5318))

### Changed

- Only pay user once for translating a given record ([#5312](https://github.com/open-chat-labs/open-chat/pull/5312))
- Simplify translations impl ([#5315](https://github.com/open-chat-labs/open-chat/pull/5315))
