# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added 

- Support cancelling invites ([#4831](https://github.com/open-chat-labs/open-chat/pull/4831))

### Changed

- Add msgpack endpoint for `delete_messages` ([#4742](https://github.com/open-chat-labs/open-chat/pull/4742))
- Platform mods can delete group messages despite not being member ([#4744](https://github.com/open-chat-labs/open-chat/pull/4744))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Use current timestamp in 'replica up to date' check ([#4763](https://github.com/open-chat-labs/open-chat/pull/4763))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Pass up number of decimals when tipping to fix notification text ([#4796](https://github.com/open-chat-labs/open-chat/pull/4796))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Add crypto payment access gate ([#4823](https://github.com/open-chat-labs/open-chat/pull/4823))

### Removed

- Remove `latest_client_event_index` from args to get events ([#4747](https://github.com/open-chat-labs/open-chat/pull/4747))

## [[2.0.930](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.930-community)] - 2023-11-09

### Changed

- Refund remaining prizes early if message gets deleted ([#4708](https://github.com/open-chat-labs/open-chat/pull/4708))
- Add `events_ttl_last_updated` to chat summaries ([#4711](https://github.com/open-chat-labs/open-chat/pull/4711))
- Support UserIndex calling `delete_messages` ([#4713](https://github.com/open-chat-labs/open-chat/pull/4713))
- Simplify and improve the @everyone Regex ([#4714](https://github.com/open-chat-labs/open-chat/pull/4714))
- Extend `c2c_report_message` endpoint ([#4719](https://github.com/open-chat-labs/open-chat/pull/4719))
- Don't collect reason or notes from reporter ([#4724](https://github.com/open-chat-labs/open-chat/pull/4724))
- Improve `ReplicaNotUpToDate` check to avoid displaying outdated events ([#4727](https://github.com/open-chat-labs/open-chat/pull/4727))
- Disallow leaving community if user is last owner of any channels ([#4731](https://github.com/open-chat-labs/open-chat/pull/4731)) 
- Consolidate logic to update thread summaries ([#4736](https://github.com/open-chat-labs/open-chat/pull/4736))

## [[2.0.921](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.921-community)] - 2023-11-02

### Added

- Add `report_message` endpoint ([#4691](https://github.com/open-chat-labs/open-chat/pull/4691))

### Changed

- Reduce size of message content when serialized ([#4680](https://github.com/open-chat-labs/open-chat/pull/4680))
- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Make `events_map` generic in preparation for moving it to stable memory ([#4689](https://github.com/open-chat-labs/open-chat/pull/4689))
- Add `latest_message_index` to chat summaries ([#4693](https://github.com/open-chat-labs/open-chat/pull/4693))
- Allow deleting all message types ([#4697](https://github.com/open-chat-labs/open-chat/pull/4697))

## [[2.0.913](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.913-community)] - 2023-10-27

### Fixed

- Fix sending of proposal messages ([#4662](https://github.com/open-chat-labs/open-chat/pull/4662))

## [[2.0.909](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.909-community)] - 2023-10-27

### Added

- Add `permissions_v2` in and out of APIs ([#4620](https://github.com/open-chat-labs/open-chat/pull/4620))

### Changed

- Don't set expiry on `EventsTimeToLiveUpdated` events ([#4616](https://github.com/open-chat-labs/open-chat/pull/4616))
- Bump `rules_accepted` timestamp even if version already accepted ([#4635](https://github.com/open-chat-labs/open-chat/pull/4635))
- Add timestamps to fields included in chat summaries ([#4637](https://github.com/open-chat-labs/open-chat/pull/4637))
- Avoid iterating events to get summary updates ([#4638](https://github.com/open-chat-labs/open-chat/pull/4638))
- Avoid iterating events to get chat member updates ([#4639](https://github.com/open-chat-labs/open-chat/pull/4639))
- Avoid iterating events to get pinned message updates ([#4643](https://github.com/open-chat-labs/open-chat/pull/4643))
- Avoid setting expiry for some event types ([#4647](https://github.com/open-chat-labs/open-chat/pull/4647))
- Return expired event + message ranges when getting events ([#4646](https://github.com/open-chat-labs/open-chat/pull/4646))

## [[2.0.889](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.889-community)] - 2023-10-19

### Added

- Add optional `diamond_only` filter to prize messages ([#4587](https://github.com/open-chat-labs/open-chat/pull/4587))

### Changed

- Allow @everyone to be followed by some punctuation ([#4553](https://github.com/open-chat-labs/open-chat/pull/4553))
- Don't auto-join gated channels ([#4561](https://github.com/open-chat-labs/open-chat/pull/4561))
- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))
- Set memo based on transaction type ([#4603](https://github.com/open-chat-labs/open-chat/pull/4603))

## [[2.0.875](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.875-community)] - 2023-10-06

### Changed

- All members can mention @everyone by default in private communities ([#4458](https://github.com/open-chat-labs/open-chat/pull/4458))
- Notifications for custom messages should use the sub-type ([#4465](https://github.com/open-chat-labs/open-chat/pull/4465))
- Join all community members to channels that are made public ([#4469](https://github.com/open-chat-labs/open-chat/pull/4469))
- Support prize messages in any token by getting fee from original transfer ([#4470](https://github.com/open-chat-labs/open-chat/pull/4470))
- Refund any prize message balance once it has ended ([#4476](https://github.com/open-chat-labs/open-chat/pull/4476))
- Switch crypto messages to only contain completed transactions ([#4489](https://github.com/open-chat-labs/open-chat/pull/4489))

## [[2.0.864](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.864-community)] - 2023-09-27

### Added

- Implement tipping messages ([#4420](https://github.com/open-chat-labs/open-chat/pull/4420))
- Implement notifications for message tips ([#4427](https://github.com/open-chat-labs/open-chat/pull/4427))
- Implement follow/unfollow thread ([#4431](https://github.com/open-chat-labs/open-chat/pull/4431))

### Changed

- Disable mentions for messages sent by the ProposalsBot ([#4424](https://github.com/open-chat-labs/open-chat/pull/4424))
- Use canister timers to remove expired events ([#4447](https://github.com/open-chat-labs/open-chat/pull/4447))

### Fixed

- Fix case where you can receive a notification for your own message ([#4425](https://github.com/open-chat-labs/open-chat/pull/4425))

## [[2.0.854](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.854-community)] - 2023-09-21

### Added

- Add `mention_all_members` group permission ([#4405](https://github.com/open-chat-labs/open-chat/pull/4405))

### Changed

- Support `@everyone` mentions ([#4405](https://github.com/open-chat-labs/open-chat/pull/4405))

## [[2.0.850](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.850-community)] - 2023-09-18

### Added

- Add `default_channel_rules` to `create_community` ([#4387](https://github.com/open-chat-labs/open-chat/pull/4374))

### Changed

- Move rules enabled into Details response + related ([#4366](https://github.com/open-chat-labs/open-chat/pull/4366))
- Allow rules to be changed without changing version ([#4374](https://github.com/open-chat-labs/open-chat/pull/4374))
- Disallow spaces in user group names ([#4384](https://github.com/open-chat-labs/open-chat/pull/4384))
- Add `CommunityRulesNotAccepted` to `send_message` response ([#?](https://github.com/open-chat-labs/open-chat/pull/?))

## [[2.0.844](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.844-community)] - 2023-09-12

### Changed

- Return `user_groups_deleted` in `selected_updates` ([#4340](https://github.com/open-chat-labs/open-chat/pull/4340))
- Add missing canisterIds to metrics ([#4346](https://github.com/open-chat-labs/open-chat/pull/4346))
- Move `InstructionCountsLog` into its own library ([#4348](https://github.com/open-chat-labs/open-chat/pull/4348))

## [[2.0.842](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.842-community)] - 2023-09-07

### Added

- Support mentioning user groups ([#4308](https://github.com/open-chat-labs/open-chat/pull/4308))
- Add optional user `display name` within community ([#4306](https://github.com/open-chat-labs/open-chat/pull/4306))
- Add `delete_user_groups` ([#4326](https://github.com/open-chat-labs/open-chat/pull/4326))

### Changed

- Return user group names in `selected_updates` ([#4328](https://github.com/open-chat-labs/open-chat/pull/4328))

## [[2.0.827](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.827-community)] - 2023-09-01

### Added

- Add optional user `display name` ([#4247](https://github.com/open-chat-labs/open-chat/pull/4247))
- Implement ability to create and update `user_groups` ([#4271](https://github.com/open-chat-labs/open-chat/pull/4271))

### Changed

- Consolidate and simplify user/group/community name validation ([#4265](https://github.com/open-chat-labs/open-chat/pull/4265))

### Fixed

- Add existing community members to newly imported public channels ([#4260](https://github.com/open-chat-labs/open-chat/pull/4260))
- One time job to add community members to all imported public channels ([#4262](https://github.com/open-chat-labs/open-chat/pull/4262))
- One time job to set the subtype on the Modclub Proposals channel ([#4267](https://github.com/open-chat-labs/open-chat/pull/4267))
- Fix `remove_member_from_channel` ([#4275](https://github.com/open-chat-labs/open-chat/pull/4275))
- One time hack to fix any incorrect links between members and channels ([#4277](https://github.com/open-chat-labs/open-chat/pull/4277))

## [[2.0.817](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.817-community)] - 2023-08-24

### Added

- Support making private groups / channels public ([#4223](https://github.com/open-chat-labs/open-chat/pull/4223))

### Changed

- Extend versioned rules to communities and groups ([#4219](https://github.com/open-chat-labs/open-chat/pull/4219))
- Make importing groups more efficient ([#4239](https://github.com/open-chat-labs/open-chat/pull/4239))

### Fixed

- Fix for owners not being able to demote other owners ([#4227](https://github.com/open-chat-labs/open-chat/pull/4227))

## [[2.0.815](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.815-community)] - 2023-08-23

### Changed

- Add timestamp to `selected_updates` and `selected_channel_updates` ([#4182](https://github.com/open-chat-labs/open-chat/pull/4182))
- Optimise `selected_channel_updates` for query caching ([#4185](https://github.com/open-chat-labs/open-chat/pull/4185))
- Allow making private communities public ([#4217](https://github.com/open-chat-labs/open-chat/pull/4217))

## [[2.0.808](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.808-community)] - 2023-08-11

### Changed

- Convert remaining SNS transactions to ICRC1 ([#4175](https://github.com/open-chat-labs/open-chat/pull/4175))

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
