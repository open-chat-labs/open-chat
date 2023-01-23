# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.558](https://github.com/open-ic/open-chat/releases/tag/v2.0.558-user_index)] - 2022-01-23

### Added

- Expose validation methods for functions that will be called via proposals ([#2990](https://github.com/open-ic/open-chat/pull/2990))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))

## [[2.0.544](https://github.com/open-ic/open-chat/releases/tag/v2.0.544-user_index)] - 2022-01-08

### Added

- Added `c2c_notify_events` for receiving events from local user indexes ([#2955](https://github.com/open-ic/open-chat/pull/2955))

### Fixed

- Free up username if registration fails ([#2952](https://github.com/open-ic/open-chat/pull/2952))
