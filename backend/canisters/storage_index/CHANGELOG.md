# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Added missing proposal validation functions ([#3298](https://github.com/open-ic/open-chat/pull/3298))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-ic/open-chat/pull/3248))
- Removed `set_governance_principals` ([#3301](https://github.com/open-ic/open-chat/pull/3301))

### Fixed

- Fixed guard on `add_bucket_canister` ([#3243](https://github.com/open-ic/open-chat/pull/3243))

## [[2.0.612](https://github.com/open-ic/open-chat/releases/tag/v2.0.612-storage_index)] - 2023-02-24

### Added

- Add `user_controllers` to metrics ([#3212](https://github.com/open-ic/open-chat/pull/3212))

### Changed

- Merge OpenStorage into the OpenChat repo ([#3185](https://github.com/open-ic/open-chat/pull/3185))
- Separate `user_controllers` from `governance_principals` ([#3187](https://github.com/open-ic/open-chat/pull/3187))