# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add the MultiUser canister skeleton with its lifecycle endpoints ([#9310](https://github.com/open-chat-labs/open-chat/pull/9310))
- Initialise the stable memory map, alongside a second map with 256 byte pages for small entries ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))

### Changed

- Update `ic-stable-structures` to a fork which supports choosing the page size of a map ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))
- Route stable memory map entries by key type to either the main map or the map for small entries ([#PRNUM](https://github.com/open-chat-labs/open-chat/pull/PRNUM))
