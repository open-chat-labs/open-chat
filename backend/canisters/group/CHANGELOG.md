# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

### Added

- Add SNS1 token to backend ([#2975](https://github.com/open-ic/open-chat/pull/2975))
- Add ckBTC token to backend ([#2981](https://github.com/open-ic/open-chat/pull/2981))

### Changed

- Skip processing notifications with no recipients ([#2979](https://github.com/open-ic/open-chat/pull/2979))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))

### Removed

- Removed `join_group_v2` which has been superseded by the new `join_group` ([#2966](https://github.com/open-ic/open-chat/pull/2966))

## [[2.0.546](https://github.com/open-ic/open-chat/releases/tag/v2.0.546-group)] - 2022-01-08

### Added

- Allow admins and senders to see deleted message content ([#2922](https://github.com/open-ic/open-chat/pull/2922))

### Changed

- Added `max_messages` to `events` and `events_window` ([#2947](https://github.com/open-ic/open-chat/pull/2947))

### Removed

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-ic/open-chat/pull/2954))
