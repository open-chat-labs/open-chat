# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add the MultiUser canister skeleton with its lifecycle endpoints ([#9310](https://github.com/open-chat-labs/open-chat/pull/9310))
- Initialise the stable memory map, alongside a second map with 256 byte pages for small entries ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))
- Add an unimplemented stub for every User canister endpoint, sharing the User canister's API types ([#9400](https://github.com/open-chat-labs/open-chat/pull/9400))
- Add the `Users` collection and per-user `User` state, `c2c_create_user` for the LocalUserIndex to add a user, and implement `bio` ([#9407](https://github.com/open-chat-labs/open-chat/pull/9407))

### Changed

- Update `ic-stable-structures` to a fork which supports choosing the page size of a map ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))
- Route stable memory map entries by key type to either the main map or the map for small entries ([#9348](https://github.com/open-chat-labs/open-chat/pull/9348))
- Prefix every stable memory map key with the index of the user it belongs to, applied at the boundary of the map so the key types are unchanged ([#9406](https://github.com/open-chat-labs/open-chat/pull/9406))
- Take the GroupIndex, Identity and Escrow canister ids and the video call operators in the init args, and include the user count in the metrics ([#9407](https://github.com/open-chat-labs/open-chat/pull/9407))
