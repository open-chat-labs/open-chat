# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add an error log with http endpoint ([#6607](https://github.com/open-chat-labs/open-chat/pull/6607))

## [[2.0.1394](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1394-airdrop_bot)] - 2024-10-16

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Introduce `TimerJobQueue` and use it for distributing airdrops ([#6498](https://github.com/open-chat-labs/open-chat/pull/6498))
- Refund user who sent tokens to the AirdropBot ([#6521](https://github.com/open-chat-labs/open-chat/pull/6521))
- Refund CHAT to another user who sent some to the AirdropBot ([#6583](https://github.com/open-chat-labs/open-chat/pull/6583))

### Fixed

- Fix AirdropBot upgrade ([#6591](https://github.com/open-chat-labs/open-chat/pull/6591))
- Fix AirdropBot upgrade (2nd attempt) ([#6592](https://github.com/open-chat-labs/open-chat/pull/6592))

## [[2.0.1314](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1314-airdrop_bot)] - 2024-09-02

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))
- Speed up airdrop distribution by running in parallel ([#6300](https://github.com/open-chat-labs/open-chat/pull/6300))
- Push failed airdrop distribution actions back to the front of the queue ([#6301](https://github.com/open-chat-labs/open-chat/pull/6301))

## [[2.0.1294](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1294-airdrop_bot)] - 2024-08-16

### Changed

- New lottery algorithm for next airdrop ([#6238](https://github.com/open-chat-labs/open-chat/pull/6238))

### Fixed

- Fix month in AirdropBot messages ([#6212](https://github.com/open-chat-labs/open-chat/pull/6212))

## [[2.0.1285](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1285-airdrop_bot)] - 2024-08-07

### Added

- Add Airdrop Bot ([#6088](https://github.com/open-chat-labs/open-chat/pull/6088))

### Changed

- Ensure users can't win multiple lottery prizes in a single draw ([#6187](https://github.com/open-chat-labs/open-chat/pull/6187))
