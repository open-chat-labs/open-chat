# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

### Added

- Added `join_group` which avoids having to wait for any inter subnet updates ([#2955](https://github.com/open-ic/open-chat/pull/2955))

### Changed

- Reduce log level of job started / stopped messages ([#2951](https://github.com/open-ic/open-chat/pull/2951))

### Removed

- Removed one-time code only needed for initializing the first local user index ([#2953](https://github.com/open-ic/open-chat/pull/2953))
- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-ic/open-chat/pull/2954))
