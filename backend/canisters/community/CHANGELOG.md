# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Convert remaining SNS transactions to ICRC1 ([#4175](https://github.com/open-chat-labs/open-chat/pull/4175))
- Add timestamp to `selected_updates` and `selected_channel_updates` ([#4182](https://github.com/open-chat-labs/open-chat/pull/4182))
- Optimise `selected_channel_updates` for query caching ([#4185](https://github.com/open-chat-labs/open-chat/pull/4185))

## [[2.0.804](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.804-community)] - 2023-08-11

### Changed

- Add support for versioned access rules ([#4159](https://github.com/open-chat-labs/open-chat/pull/4159))

### Removed

- Remove SNS transaction types ([#4162](https://github.com/open-chat-labs/open-chat/pull/4162))

## [[2.0.801](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.801-community)] - 2023-08-08

### Changed

- Simplify notification types ([#4148](https://github.com/open-chat-labs/open-chat/pull/4148))
- Validate text length based on number of chars rather than bytes ([#4154](https://github.com/open-chat-labs/open-chat/pull/4154))

### Removed

- Remove remaining default channels code ([#4144](https://github.com/open-chat-labs/open-chat/pull/4144))

## [[2.0.789](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.789-community)] - 2023-08-04

### Changed

- More efficient serialization of notifications ([#4134](https://github.com/open-chat-labs/open-chat/pull/4134))
- Give public channels default behaviour ([#4137](https://github.com/open-chat-labs/open-chat/pull/4137))
- Add all members to all public channels ([#4140](https://github.com/open-chat-labs/open-chat/pull/4140))

## [[2.0.776](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.776-community)] - 2023-08-01

### Added

- Finish implementing `import_proposals_group_into_community` ([#4089](https://github.com/open-chat-labs/open-chat/pull/4089))

## [[2.0.772](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.772-community)] - 2023-07-31

### Changed

- Clear failing group imports ([#4083](https://github.com/open-chat-labs/open-chat/pull/4083))

### Fixed

- Newly imported channels missing from updates loop ([#4079](https://github.com/open-chat-labs/open-chat/pull/4079))

## [[2.0.768](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.768-community)] - 2023-07-31

### Changed

- Always use `MembersAddedToDefaultChannel` events for default channels ([#4071](https://github.com/open-chat-labs/open-chat/pull/4071))
- Return new members in `selected_channel_updates` after `MembersAddedToDefaultChannel` ([#4072](https://github.com/open-chat-labs/open-chat/pull/4072))

## [[2.0.762](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.762-community)] - 2023-07-28

### Changed

- Return `SuccessJoinedCommunity` after joining default channel ([#3997](https://github.com/open-chat-labs/open-chat/pull/3997))
- Fetch `user_id` from `invited_users` when getting channel summary ([#3999](https://github.com/open-chat-labs/open-chat/pull/3999))
- Store principals of invited users ([#4002](https://github.com/open-chat-labs/open-chat/pull/4002))
- Mark channels as read after joining community or channel ([#4004](https://github.com/open-chat-labs/open-chat/pull/4004))
- Trim messages before pushing them as notifications ([#4020](https://github.com/open-chat-labs/open-chat/pull/4020))
- Support sending any ICRC1 tokens ([#4026](https://github.com/open-chat-labs/open-chat/pull/4026))
- Add `GroupImportedInternal` community event type ([#4028](https://github.com/open-chat-labs/open-chat/pull/4028))
- Add new `MembersAddedToDefaultChannel` event type ([#4032](https://github.com/open-chat-labs/open-chat/pull/4032))
- Add all community members to channel when it is set as default ([#4033](https://github.com/open-chat-labs/open-chat/pull/4033))
- Finalize any completed group imports in `post_upgrade` ([#4035](https://github.com/open-chat-labs/open-chat/pull/4035))
- Trigger upgrade if finalizing group import exceeds instruction limit ([#4037](https://github.com/open-chat-labs/open-chat/pull/4037))
- Add all community members to a default channel when it is created ([#4041](https://github.com/open-chat-labs/open-chat/pull/4041))
- Use `TimerJobs` to persist canister timers across upgrades ([#4043](https://github.com/open-chat-labs/open-chat/pull/4043))

### Removed

- Consolidate remove and block permissions ([#4030](https://github.com/open-chat-labs/open-chat/pull/4030))

### Fixed

- Ensure public channel names are ci unique ([#4044](https://github.com/open-chat-labs/open-chat/pull/4044))
- Fix creation of proposal channels ([#4046](https://github.com/open-chat-labs/open-chat/pull/4046))

## [[2.0.749](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.749-community)] - 2023-07-20

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

### Fixed

- Fix channel missing from updates after being imported ([#3978](https://github.com/open-chat-labs/open-chat/pull/3978))

## [[2.0.740](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.740-community)] - 2023-07-07

### Added

- The first version of the community canister
