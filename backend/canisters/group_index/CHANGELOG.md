# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Introduce standardised error codes ([#7599](https://github.com/open-chat-labs/open-chat/pull/7599))

## [[2.0.1636](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1636-group_index)] - 2025-03-11

### Changed

- Log error response if any canister wasm upgrades are rejected ([#7566](https://github.com/open-chat-labs/open-chat/pull/7566))

## [[2.0.1635](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1635-group_index)] - 2025-03-10

### Changed

- Use `unbounded_wait` when installing canisters ([#7558](https://github.com/open-chat-labs/open-chat/pull/7558))

## [[2.0.1630](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1630-group_index)] - 2025-03-10

### Added

- Add `versions` to upgrade filter to filter canisters to upgrade by version ([#7531](https://github.com/open-chat-labs/open-chat/pull/7531))

### Changed

- Switch to using bounded-wait calls for idempotent c2c calls ([#7528](https://github.com/open-chat-labs/open-chat/pull/7528))
- Log total instructions consumed at end of upgrade ([#7551](https://github.com/open-chat-labs/open-chat/pull/7551))
- Log number of public and private groups active in the last year ([#7552](https://github.com/open-chat-labs/open-chat/pull/7552))

### Fixed

- Clear cached hot groups to fix deserialization during upgrade ([#7556](https://github.com/open-chat-labs/open-chat/pull/7556))

## [[2.0.1613](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1613-group_index)] - 2025-02-28

### Added

- Introduce `IdempotencyChecker` in preparation for using best-effort calls ([#7457](https://github.com/open-chat-labs/open-chat/pull/7457))

### Fixed

- Avoid retrying c2c call if recipient canister is uninstalled ([#7302](https://github.com/open-chat-labs/open-chat/pull/7302))
- Unreserve group/community name if fails to be created ([#7430](https://github.com/open-chat-labs/open-chat/pull/7430))

## [[2.0.1584](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1584-group_index)] - 2025-01-24

### Added

- Add facility to set/revoke community/group verification via proposal ([#7240](https://github.com/open-chat-labs/open-chat/pull/7240))

### Changed

- Reduce message Ids to 64 bits down from 128 bits ([#7232](https://github.com/open-chat-labs/open-chat/pull/7232))

### Fixed

- Revoke Group/Community verified status if they change name ([#7277](https://github.com/open-chat-labs/open-chat/pull/7277))

## [[2.0.1541](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1541-group_index)] - 2024-12-19

### Changed

- Handle retry attempts when adding a new LocalGroupIndex ([#7091](https://github.com/open-chat-labs/open-chat/pull/7091))
- Add logging + skip steps that have already been completed ([#7093](https://github.com/open-chat-labs/open-chat/pull/7093))

### Fixed

- Set `wasm_hash` field which was previously empty ([#7097](https://github.com/open-chat-labs/open-chat/pull/7097))

## [[2.0.1528](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1528-group_index)] - 2024-12-19

### Changed

- Allow Registry to add additional LocalGroupIndexes ([#7072](https://github.com/open-chat-labs/open-chat/pull/7072))
- Handle installing large wasms onto new subnets ([#7078](https://github.com/open-chat-labs/open-chat/pull/7078))

## [[2.0.1509](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1509-group_index)] - 2024-12-13

### Changed

- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))
- Make `MessageId` comparisons use their 64bit representation ([#7030](https://github.com/open-chat-labs/open-chat/pull/7030))

### Removed

- Remove the old `gate` field which has been superseded by `gate_config` ([#6902](https://github.com/open-chat-labs/open-chat/pull/6902))

## [[2.0.1474](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1474-group_index)] - 2024-11-26

### Changed

- Revert temporary hacks to fix upgrade ([#6894](https://github.com/open-chat-labs/open-chat/pull/6894))
- Store access gate expiry alongside each public group ([#6896](https://github.com/open-chat-labs/open-chat/pull/6896))

## [[2.0.1472](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1472-group_index)] - 2024-11-26

### Added

- Add support for expiring access gates ([#6401](https://github.com/open-chat-labs/open-chat/pull/6401))
- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Add `CanisterWasmBytes` to reduce duplication ([#6480](https://github.com/open-chat-labs/open-chat/pull/6480))
- Log error if chunked Group/Community upgrade fails ([#6483](https://github.com/open-chat-labs/open-chat/pull/6483))
- Clear wasm chunks once new wasm version has been set ([#6524](https://github.com/open-chat-labs/open-chat/pull/6524))
- Simplify `inspect_message` ([#6847](https://github.com/open-chat-labs/open-chat/pull/6847))
- Make `ChannelId` comparisons use their 32bit representation ([#6885](https://github.com/open-chat-labs/open-chat/pull/6885))

### Fixed

- Wire up `freeze_community` in `inspect_message` ([#6764](https://github.com/open-chat-labs/open-chat/pull/6764))
- Fix GroupIndex upgrade ([#6890](https://github.com/open-chat-labs/open-chat/pull/6890))

## [[2.0.1360](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1360-group_index)] - 2024-09-30

### Added

- Support upgrading to large wasms by uploading in chunks ([#6453](https://github.com/open-chat-labs/open-chat/pull/6453))
- Reinstate some candid endpoints ([#6468](https://github.com/open-chat-labs/open-chat/pull/6468))

### Changed

- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))

### Removed

- Remove the unused `use_for_new_canisters` field from upgrade args ([#6452](https://github.com/open-chat-labs/open-chat/pull/6452))

## [[2.0.1355](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1355-group_index)] - 2024-09-20

### Added

- Add `ReferredByMember` access gate ([#6377](https://github.com/open-chat-labs/open-chat/pull/6377))

### Removed

- Remove deprecated candid endpoints ([#6396](https://github.com/open-chat-labs/open-chat/pull/6396))

## [[2.0.1332](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1332-group_index)] - 2024-09-06

### Added

- Expose MessagePack versions of GroupIndex APIs ([#6318](https://github.com/open-chat-labs/open-chat/pull/6318))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))

## [[2.0.1318](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1318-group_index)] - 2024-09-02

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1270](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1270-group_index)] - 2024-07-31

### Changed

- Configure message visibility to non-members of public channels/groups ([#6152](https://github.com/open-chat-labs/open-chat/pull/6152))

## [[2.0.1260](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1260-group_index)] - 2024-07-26

### Removed

- Remove `Invited` gate ([#6112](https://github.com/open-chat-labs/open-chat/pull/6112))

## [[2.0.1253](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1253-group_index)] - 2024-07-25

### Added

- Add `Locked` gate ([#6095](https://github.com/open-chat-labs/open-chat/pull/6095))
- Add `Invited` gate ([#6106](https://github.com/open-chat-labs/open-chat/pull/6106))

### Changed

- Clear old data from the failed upgrades log ([#6062](https://github.com/open-chat-labs/open-chat/pull/6062))
- Ensure GroupIndex is only controller before installing LocalGroupIndex ([#6070](https://github.com/open-chat-labs/open-chat/pull/6070))

## [[2.0.1240](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1240-group_index)] - 2024-07-17

### Fixed

- Handle `mark_local_group_index_full` in `inspect_message` ([#6010](https://github.com/open-chat-labs/open-chat/pull/6010))

## [[2.0.1228](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1228-group_index)] - 2024-07-08

### Added

- Allow platform operators to mark LocalGroupIndexes full ([#6000](https://github.com/open-chat-labs/open-chat/pull/6000))

## [[2.0.1188](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1188-group_index)] - 2024-06-04

### Changed

- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))
- Don't retry c2c calls after getting a `DestinationInvalid` error ([#5732](https://github.com/open-chat-labs/open-chat/pull/5732))
- Don't retry c2c calls after getting a `CanisterMethodNotFound` error ([#5747](https://github.com/open-chat-labs/open-chat/pull/5747))
- Store IC root key in groups and communities ([#5816](https://github.com/open-chat-labs/open-chat/pull/5816))
- Store `internet_identity_canister_id` in groups and communities ([#5823](https://github.com/open-chat-labs/open-chat/pull/5823))
- Add `credential_name` to verified credential access gates ([#5853](https://github.com/open-chat-labs/open-chat/pull/5853))

### Fixed

- Add `serde(default)` attribute to fix upgrade ([#5857](https://github.com/open-chat-labs/open-chat/pull/5857))

## [[2.0.1135](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1135-group_index)] - 2024-04-10

### Fixed

- Fix 'out of cycles' check to use new response code ([#5503](https://github.com/open-chat-labs/open-chat/pull/5503))

## [[2.0.1085](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1085-group_index)] - 2024-03-04

### Changed

- Add `event_relay_canister_id` to LocalGroupIndex init args ([#5436](https://github.com/open-chat-labs/open-chat/pull/5436))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))

## [[2.0.1073](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1073-group_index)] - 2024-02-22

### Changed

- Propagate video call operators ids for guarding ([#5374](https://github.com/open-chat-labs/open-chat/pull/5374))

## [[2.0.1025](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1025-group_index)] - 2024-01-25

### Added

- VideoCall message + permission + summary/updates ([#5357](https://github.com/open-chat-labs/open-chat/pull/5357))

### Changed

- Simplify timer jobs + make them more efficient ([#5233](https://github.com/open-chat-labs/open-chat/pull/5233))
- Rename `service_principals` to `governance_principals` in init args ([#5251](https://github.com/open-chat-labs/open-chat/pull/5251))
- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))
- Propagate video call operators ids for guarding ([#5374](https://github.com/open-chat-labs/open-chat/pull/5374))

## [[2.0.1010](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1010-group_index)] - 2024-01-18

### Added

- Expose metrics of access gates on public groups and communities ([#5118](https://github.com/open-chat-labs/open-chat/pull/5118))
- Add TokenBalance access gate ([#5120](https://github.com/open-chat-labs/open-chat/pull/5120))

### Changed

- Add `subtype` to group search results ([#5084](https://github.com/open-chat-labs/open-chat/pull/5084))
- Better formatting of proposal payloads ([#5115](https://github.com/open-chat-labs/open-chat/pull/5115))
- Ensure swap responses contain all transaction ids ([#5174](https://github.com/open-chat-labs/open-chat/pull/5174))

## [[2.0.979](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.979-group_index)] - 2023-12-19

### Changed

- Add `escrow_canister_id` to LocalGroupIndex canister init args ([#4897](https://github.com/open-chat-labs/open-chat/pull/4897))

### Fixed

- Fix incorrect `local_user_index_canister_id` values ([#5009](https://github.com/open-chat-labs/open-chat/pull/5009))

## [[2.0.951](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.951-group_index)] - 2023-11-28

### Changed

- In modclub reports only show public message links ([#4847](https://github.com/open-chat-labs/open-chat/pull/4847))
- Add `local_user_index_canister_id` to group/community summaries ([#4857](https://github.com/open-chat-labs/open-chat/pull/4857))

## [[2.0.942](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.942-group_index)] - 2023-11-24

### Changed

- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Add crypto payment access gate ([#4823](https://github.com/open-chat-labs/open-chat/pull/4823))

## [[2.0.933](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.933-group_index)] - 2023-11-10

### Changed

- Add `events_ttl_last_updated` to chat summaries ([#4711](https://github.com/open-chat-labs/open-chat/pull/4711))
- Implement `group_index::c2c_report_message` ([#4723](https://github.com/open-chat-labs/open-chat/pull/4723))
- Don't collect reason or notes from reporter ([#4724](https://github.com/open-chat-labs/open-chat/pull/4724))

## [[2.0.926](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.926-group_index)] - 2023-11-03

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Add `latest_message_index` to chat summaries ([#4693](https://github.com/open-chat-labs/open-chat/pull/4693))

### Removed

- Removed old permissions code ([#4667](https://github.com/open-chat-labs/open-chat/pull/4667))

## [[2.0.907](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.907-group_index)] - 2023-10-27

### Added

- Add `permissions_v2` to `c2c_create_group` ([#4620](https://github.com/open-chat-labs/open-chat/pull/4620))

## [[2.0.894](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.894-group_index)] - 2023-10-19

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

### Removed

- Removed `filter_groups` and `c2c_filter_groups` ([#4513](https://github.com/open-chat-labs/open-chat/pull/4513))

## [[2.0.866](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.866-group_index)] - 2023-09-27

### Changed

- Accept calls to `set_community_upgrade_concurrency` ([#4418](https://github.com/open-chat-labs/open-chat/pull/4418))

## [[2.0.857](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.857-group_index)] - 2023-09-21

### Added

- Add `mention_all_members` group permission ([#4405](https://github.com/open-chat-labs/open-chat/pull/4405))

### Changed

- Accept calls to `set_max_concurrent_community_canister_upgrades` ([#4391](https://github.com/open-chat-labs/open-chat/pull/4391))

## [[2.0.848](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.848-group_index)] - 2023-09-18

### Added

- Add `default_channel_rules` to `create_community` ([#4387](https://github.com/open-chat-labs/open-chat/pull/4374))

## [[2.0.828](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.828-group_index)] - 2023-09-01

### Added

- Implement ability to create and update `user_groups` ([#4271](https://github.com/open-chat-labs/open-chat/pull/4271))

### Fixed

- Support changing casing of public groups / communities ([#4258](https://github.com/open-chat-labs/open-chat/pull/4258))

## [[2.0.816](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.816-group_index)] - 2023-08-23

### Changed

- Allow making private communities public ([#4217](https://github.com/open-chat-labs/open-chat/pull/4217))

## [[2.0.813](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.813-group_index)] - 2023-08-22

### Changed

- Improve upgrade version check to support multiple active versions ([#4215](https://github.com/open-chat-labs/open-chat/pull/4215))

## [[2.0.811](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.811-group_index)] - 2023-08-21

### Changed

- Include `use_for_new_canisters` when displaying upgrade proposals ([#4214](https://github.com/open-chat-labs/open-chat/pull/4214))

## [[2.0.793](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.793-group_index)] - 2023-08-08

### Changed

- Bump number of cycles required for upgrade ([#4155](https://github.com/open-chat-labs/open-chat/pull/4155))

## [[2.0.788](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.788-group_index)] - 2023-08-04

### Changed

- Make `notifications_pending` metrics update instantly ([#4118](https://github.com/open-chat-labs/open-chat/pull/4118))
- Renamed `other_default_channels` to `other_public_channels` ([#4137](https://github.com/open-chat-labs/open-chat/pull/4137))

## [[2.0.782](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.782-group_index)] - 2023-08-02

### Changed

- Retry failed group deleted notifications ([#4101](https://github.com/open-chat-labs/open-chat/pull/4101))
- Remove random factor in `explore_communities` ([#4102](https://github.com/open-chat-labs/open-chat/pull/4102))
- Add `score` to `CommunityMatch` ([#4106](https://github.com/open-chat-labs/open-chat/pull/4106))
- Prevent log(0) in hotness calculation ([#4110](https://github.com/open-chat-labs/open-chat/pull/4110))

## [[2.0.769](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.769-group_index)] - 2023-07-31

### Added

- Add API endpoint `lookup_channel_by_group_id` ([#4066](https://github.com/open-chat-labs/open-chat/pull/4066))
- Handle `set_community_moderation_flags` in `inspect_message` ([#4076](https://github.com/open-chat-labs/open-chat/pull/4076))

## [[2.0.760](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.760-group_index)] - 2023-07-28

### Changed

- Mark channels as read after joining community or channel ([#4004](https://github.com/open-chat-labs/open-chat/pull/4004))
- Use `include_moderation_flags` rather than `exclude_moderation_flags` ([#4050](https://github.com/open-chat-labs/open-chat/pull/4050))

### Deprecated

- Deprecate and remove usages of `filter_groups` ([#4003](https://github.com/open-chat-labs/open-chat/pull/4003))

### Removed

- Consolidate remove and block community permissions ([#4030](https://github.com/open-chat-labs/open-chat/pull/4030))

## [[2.0.748](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.748-group_index)] - 2023-07-20

### Changed

- Set `activity` field on new public communities ([#3961](https://github.com/open-chat-labs/open-chat/pull/3961))
- Set community avatar after converting group into community ([#3976](https://github.com/open-chat-labs/open-chat/pull/3976))
- Allow unfreezing a group even if group index is unaware it is frozen ([#3992](https://github.com/open-chat-labs/open-chat/pull/3992))

## [[2.0.743](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.743-group_index)] - 2023-07-14

### Added

- Public community moderation flags ([#3911](https://github.com/open-chat-labs/open-chat/pull/3911))
- Explore communities with language filter ([#3923](https://github.com/open-chat-labs/open-chat/pull/3923))
- Return language with community match ([#3937](https://github.com/open-chat-labs/open-chat/pull/3937))
- Add `total` to search results ([#3940](https://github.com/open-chat-labs/open-chat/pull/3940))

### Changed

- Fix `explore_groups` and `explore_communities` in edge case ([#3860](https://github.com/open-chat-labs/open-chat/pull/3860))
- Add `channel_id` to `c2c_convert_group_into_community` args ([#3929](https://github.com/open-chat-labs/open-chat/pull/3929))

## [[2.0.734](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.734-group_index)] - 2023-06-27

### Added

- Add ability to import a group into a community ([#3792](https://github.com/open-chat-labs/open-chat/pull/3792))
- Added `explore_groups` endpoint ([#3826](https://github.com/open-chat-labs/open-chat/pull/3826))
- Implement converting a group into a community ([#3833](https://github.com/open-chat-labs/open-chat/pull/3833))
- Add `c2c_mark_group_import_complete` ([#3840](https://github.com/open-chat-labs/open-chat/pull/3840))

### Changed

- New algo for ordering "hot" groups & communities ([#3820](https://github.com/open-chat-labs/open-chat/pull/3820))
- Unified namespace for public groups and communities ([#3849](https://github.com/open-chat-labs/open-chat/pull/3849))

## [[2.0.723](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.723-group_index)] - 2023-06-16

### Added

- Added active_groups and c2c_active_groups endpoints ([#3759](https://github.com/open-chat-labs/open-chat/pull/3759))
- Added search_v2 endpoint ([#3763](https://github.com/open-chat-labs/open-chat/pull/3763))
- Support community banner ([#3765](https://github.com/open-chat-labs/open-chat/pull/3765))
- Added `explore_communities` endpoint ([#3796](https://github.com/open-chat-labs/open-chat/pull/3796))

### Removed

- Removed `search_v2` endpoint ([#3796](https://github.com/open-chat-labs/open-chat/pull/3796))

### Fixed

- Fix `c2c_create_community` ([#3777](https://github.com/open-chat-labs/open-chat/pull/3777))

## [[2.0.703](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.703-group_index)] - 2023-06-01

### Added

- Integrate Communities ([#3656](https://github.com/open-chat-labs/open-chat/pull/3656)), ([#3657](https://github.com/open-chat-labs/open-chat/pull/3657)), ([#3687](https://github.com/open-chat-labs/open-chat/pull/3687))

## [[2.0.692](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.692-group_index)] - 2023-05-17

### Changed

- Removed time limit before frozen groups can be deleted ([#3490](https://github.com/open-chat-labs/open-chat/pull/3490))
- Reduce a few timer job intervals ([#3515](https://github.com/open-chat-labs/open-chat/pull/3515))
- Added `moderator` role and removed `add_members` permission ([#3592](https://github.com/open-chat-labs/open-chat/pull/3592))
- Put back `add_members` permission with serde default ([#3599](https://github.com/open-chat-labs/open-chat/pull/3599))
- Improve search by splitting "terms" into "tokens" ([#3689](https://github.com/open-chat-labs/open-chat/pull/3689))

## [[2.0.665](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.665-group_index)] - 2023-04-17

### Added

- Implement 'Gated Groups' ([#3406](https://github.com/open-chat-labs/open-chat/pull/3406))

### Removed

- Removed `c2c_recommended_groups` ([#3412](https://github.com/open-chat-labs/open-chat/pull/3412))

## [[2.0.642](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.642-group_index)] - 2023-03-24

### Removed

- Remove owner_id from cached groups ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))

## [[2.0.629](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.629-group_index)] - 2023-03-13

### Added

- Endpoint for platform ops to set group upgrade concurrency ([#3268](https://github.com/open-chat-labs/open-chat/pull/3268))

### Changed

- Rename is_super_admin to is_platform_operator in c2c_lookup_user ([#3264](https://github.com/open-chat-labs/open-chat/pull/3264))

### Removed

- Removed code only needed for previous upgrade ([#3262](https://github.com/open-chat-labs/open-chat/pull/3262))
- Removed `set_governance_principals` ([#3301](https://github.com/open-chat-labs/open-chat/pull/3301))

## [[2.0.624](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.624-group_index)] - 2023-03-02

### Added

- Add endpoints to add/remove a hot group exclusion ([#3254](https://github.com/open-chat-labs/open-chat/pull/3254))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248)) & ([#3251](https://github.com/open-chat-labs/open-chat/pull/3251))
- Removed all the code around reinstalling groups ([#3253](https://github.com/open-chat-labs/open-chat/pull/3253))

## [[2.0.617](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.617-group_index)] - 2023-02-28

### Added

- One time job to delete all frozen groups ([#3228](https://github.com/open-chat-labs/open-chat/pull/3228))

### Changed

- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-chat-labs/open-chat/pull/3158))

## [[2.0.601](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.601-group_index)] - 2023-02-17

### Added

- Added `reinstall_group` for recovering groups which are un-upgradable due to bug in `pre_upgrade` ([#3128](https://github.com/open-chat-labs/open-chat/pull/3128))
- Added `frozen_groups` to metrics ([#3140](https://github.com/open-chat-labs/open-chat/pull/3140))
- Added `delete_frozen_group` ([£3144](https://github.com/open-chat-labs/open-chat/pull/3144))
- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-chat-labs/open-chat/pull/3145))

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-chat-labs/open-chat/pull/3133))
- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-chat-labs/open-chat/pull/3152))

### Removed

- Removed code to initialize `proposals_bot_user_id` value ([#3124](https://github.com/open-chat-labs/open-chat/pull/3124))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-chat-labs/open-chat/pull/3143))

## [[2.0.581](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.581-group_index)] - 2023-02-09

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-chat-labs/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Pass in the ProposalsBot userId when initializing each LocalGroupIndex ([#3080](https://github.com/open-chat-labs/open-chat/pull/3080))

## [[2.0.571](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.571-group_index)] - 2023-02-01

### Added

- Added `events_ttl` field to `c2c_create_group` args for setting the 'time to live' for disappearing messages ([#3029](https://github.com/open-chat-labs/open-chat/pull/3029))
- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-chat-labs/open-chat/pull/3038))

# Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))

## [[2.0.556](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.556-group_index)] - 2023-01-23

### Added

- Expose validation methods for functions that will be called via proposals ([#2990](https://github.com/open-chat-labs/open-chat/pull/2990))

### Changed

- Reduce log level of job started / stopped messages ([#2951](https://github.com/open-chat-labs/open-chat/pull/2951))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))
