# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

## [[2.0.547](https://github.com/open-ic/open-chat/releases/tag/v2.0.547-user)] - 2022-01-08

### Added

- Added `UserJoinedGroup` event type for supporting the new `join_group` flow ([#2955](https://github.com/open-ic/open-chat/pull/2955))
- Added `c2c_notify_events` which deprecates `c2c_notify_user_events` ([#2955](https://github.com/open-ic/open-chat/pull/2955))

### Changed

- Added `max_messages` to `events` and `events_window` ([#2947](https://github.com/open-ic/open-chat/pull/2947))

### Removed 

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-ic/open-chat/pull/2954))
