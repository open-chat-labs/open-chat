# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Log total instructions consumed at end of upgrade ([#7551](https://github.com/open-chat-labs/open-chat/pull/7551))
- Parallelise uploading wasm chunks ([#7643](https://github.com/open-chat-labs/open-chat/pull/7643))

## [[2.0.1549](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1549-openchat_installer)] - 2025-01-06

### Fixed

- Fix `upgrade_canister` to first assemble the wasm from the chunks ([#7161](https://github.com/open-chat-labs/open-chat/pull/7161))

## [[2.0.1548](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1548-openchat_installer)] - 2025-01-06

### Added

- Add OpenChatInstaller canister ([#7137](https://github.com/open-chat-labs/open-chat/pull/7137))
- Use OpenChatInstaller to install UserIndex ([#7137](https://github.com/open-chat-labs/open-chat/pull/7137))
- Use OpenChatInstaller to install GroupIndex and NotificationsIndex ([#7141](https://github.com/open-chat-labs/open-chat/pull/7141))

