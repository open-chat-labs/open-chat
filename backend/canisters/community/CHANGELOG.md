# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Wire up channel avatars ([#3957](https://github.com/open-chat-labs/open-chat/pull/3957))
- When user leaves community push event to each channel they were in ([#3963](https://github.com/open-chat-labs/open-chat/pull/3963))
- Remove dependencies on IC repo ([#3970](https://github.com/open-chat-labs/open-chat/pull/3970))
- Add `invite_code` to `channel_summary` args ([#3975](https://github.com/open-chat-labs/open-chat/pull/3975))
- Use `canister_client` for making all c2c calls ([#3979](https://github.com/open-chat-labs/open-chat/pull/3979))
- Avoid using `candid::Func` type directly ([#3983](https://github.com/open-chat-labs/open-chat/pull/3983))
- Hide latest channel messages from users not in community ([#3987](https://github.com/open-chat-labs/open-chat/pull/3987))
- Allow users to join community and channel in a single call ([#3988](https://github.com/open-chat-labs/open-chat/pull/3988))
- Allow inviting non-community members directly into a channel ([#3990](https://github.com/open-chat-labs/open-chat/pull/3990))
- Return `SuccessJoinedCommunity` after joining default channel ([#3997](https://github.com/open-chat-labs/open-chat/pull/3997))

### Fixed

- Fix channel missing from updates after being imported ([#3978](https://github.com/open-chat-labs/open-chat/pull/3978))

## [[2.0.740](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.740-community)] - 2023-07-07

### Added

- The first version of the community canister