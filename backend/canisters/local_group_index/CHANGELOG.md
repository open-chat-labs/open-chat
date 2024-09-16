# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add `ReferredByMember` access gate ([#6377](https://github.com/open-chat-labs/open-chat/pull/6377))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))

## [[2.0.1328](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1328-local_group_index)] - 2024-09-03

### Changed

- Mark ProposalsBot as OC controlled bot ([#6287](https://github.com/open-chat-labs/open-chat/pull/6287))

## [[2.0.1309](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1309-local_group_index)] - 2024-08-26

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1292](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1292-local_group_index)] - 2024-08-16

### Changed

- Remove references to deleted users ([#6241](https://github.com/open-chat-labs/open-chat/pull/6241))

## [[2.0.1271](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1271-local_group_index)] - 2024-07-31

### Changed

- Configure message visibility to non-members of public channels/groups ([#6152](https://github.com/open-chat-labs/open-chat/pull/6152))

## [[2.0.1259](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1259-local_group_index)] - 2024-07-26

### Changed

- Use `UserType` rather than `is_bot` and `is_oc_controlled_bot` ([#6116](https://github.com/open-chat-labs/open-chat/pull/6116))

### Removed

- Remove `Invited` gate ([#6112](https://github.com/open-chat-labs/open-chat/pull/6112))

## [[2.0.1254](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1254-local_group_index)] - 2024-07-25

### Added

- Add `Locked` gate ([#6095](https://github.com/open-chat-labs/open-chat/pull/6095))
- Add `Invited` gate ([#6106](https://github.com/open-chat-labs/open-chat/pull/6106))

### Changed

- Clear old data from the failed upgrades log ([#6062](https://github.com/open-chat-labs/open-chat/pull/6062))

## [[2.0.1232](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1232-local_group_index)] - 2024-07-09

### Added

- Add `LifetimeDiamondMembership` access gate ([#5986](https://github.com/open-chat-labs/open-chat/pull/5986))
- Add `UniquePerson` access gate ([#5993](https://github.com/open-chat-labs/open-chat/pull/5993))
- Support composite access gates ([#5988](https://github.com/open-chat-labs/open-chat/pull/5988))

## [[2.0.1189](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1189-local_group_index)] - 2024-04-23

### Changed

- Store IC root key in groups and communities ([#5816](https://github.com/open-chat-labs/open-chat/pull/5816))
- Store `internet_identity_canister_id` in groups and communities ([#5823](https://github.com/open-chat-labs/open-chat/pull/5823))
- Add `credential_name` to verified credential access gates ([#5853](https://github.com/open-chat-labs/open-chat/pull/5853))

## [[2.0.1150](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1150-local_group_index)] - 2024-04-23

### Changed

- Update `event_store` packages to v0.1.0 ([#5715](https://github.com/open-chat-labs/open-chat/pull/5715))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

## [[2.0.1136](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1136-local_group_index)] - 2024-04-10

### Added

- Push `group/community_created` events ([#5525](https://github.com/open-chat-labs/open-chat/pull/5525))

### Changed

- Update `event_store` packages to latest version ([#5593](https://github.com/open-chat-labs/open-chat/pull/5593))

## [[2.0.1114](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1114-local_group_index)] - 2024-03-20

### Changed

- Update `event_store` packages to latest version ([#5535](https://github.com/open-chat-labs/open-chat/pull/5535))
- Anonymize all Group/Community canisters in events ([#5568](https://github.com/open-chat-labs/open-chat/pull/5568))

### Fixed

- Fix upgrading from previous events format ([#5579](https://github.com/open-chat-labs/open-chat/pull/5579))

## [[2.0.1098](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1098-local_group_index)] - 2024-03-11

### Fixed

- Only clear the chunk store if no upgrades running ([#5510](https://github.com/open-chat-labs/open-chat/pull/5510))
- Retry failed community upgrades ([#5511](https://github.com/open-chat-labs/open-chat/pull/5511))

## [[2.0.1095](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1095-local_group_index)] - 2024-03-08

### Changed

- Pause upgrades if events queue becomes too large ([#5507](https://github.com/open-chat-labs/open-chat/pull/5507))

### Fixed

- Fix 'out of cycles' check to use new response code ([#5503](https://github.com/open-chat-labs/open-chat/pull/5503))
- Retry community upgrades which failed due to insufficient cycles ([#5506](https://github.com/open-chat-labs/open-chat/pull/5506))

## [[2.0.1087](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1087-local_group_index)] - 2024-03-04

### Added

- Implement ability to push events from Group & Community canisters ([#5436](https://github.com/open-chat-labs/open-chat/pull/5436))

### Changed

- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))

## [[2.0.1074](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1074-local_group_index)] - 2024-02-22

### Added

- VideoCall message + permission + summary/updates ([#5357](https://github.com/open-chat-labs/open-chat/pull/5357))

### Changed

- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))
- Propagate video call operators ids for guarding ([#5374](https://github.com/open-chat-labs/open-chat/pull/5374))
- Use `install_chunked_code` to upgrade Group + Community canisters ([#5412](https://github.com/open-chat-labs/open-chat/pull/5412))

### Fixed

- Fix community canister upgrades ([#5422](https://github.com/open-chat-labs/open-chat/pull/5422))

## [[2.0.1012](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1012-local_group_index)] - 2024-01-18

### Added

- Add TokenBalance access gate ([#5120](https://github.com/open-chat-labs/open-chat/pull/5120))

## [[2.0.978](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.978-local_group_index)] - 2023-12-19

### Changed

- Add `escrow_canister_id` to Group & Community canister init args ([#4897](https://github.com/open-chat-labs/open-chat/pull/4897))

### Fixed

- Fix incorrect `local_user_index_canister_id` values ([#5009](https://github.com/open-chat-labs/open-chat/pull/5009))

## [[2.0.954](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.954-local_group_index)] - 2023-12-01

### Changed

- Add `local_user_index_canister_id` to group/community summaries ([#4857](https://github.com/open-chat-labs/open-chat/pull/4857))

## [[2.0.944](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.944-local_group_index)] - 2023-11-24

### Changed

- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Add crypto payment access gate ([#4823](https://github.com/open-chat-labs/open-chat/pull/4823))

## [[2.0.925](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.925-local_group_index)] - 2023-11-03

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))

### Removed

- Removed old permissions code ([#4667](https://github.com/open-chat-labs/open-chat/pull/4667))

## [[2.0.908](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.908-local_group_index)] - 2023-10-27

### Added

- Add `permissions_v2` to `c2c_create_group` ([#4620](https://github.com/open-chat-labs/open-chat/pull/4620))

## [[2.0.896](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.896-local_group_index)] - 2023-10-19

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

## [[2.0.856](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.856-local_group_index)] - 2023-09-21

### Added

- Add `mention_all_members` group permission ([#4405](https://github.com/open-chat-labs/open-chat/pull/4405))
  
## [[2.0.849](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.849-local_group_index)] - 2023-09-18

### Added

- Add `default_channel_rules` to `create_community` ([#4387](https://github.com/open-chat-labs/open-chat/pull/4374))

## [[2.0.825](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.825-local_group_index)] - 2023-09-01

### Added

- Implement ability to create and update `user_groups` ([#4271](https://github.com/open-chat-labs/open-chat/pull/4271))

## [[2.0.812](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.812-local_group_index)] - 2023-08-22

### Changed

- Improve upgrade version check to support multiple active versions ([#4215](https://github.com/open-chat-labs/open-chat/pull/4215))

## [[2.0.800](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.800-local_group_index)] - 2023-08-08

### Changed

- Bump number of cycles required for upgrade ([#4155](https://github.com/open-chat-labs/open-chat/pull/4155))

## [[2.0.785](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.785-local_group_index)] - 2023-08-03

### Changed

- Authorize community canisters to push notifications ([#4126](https://github.com/open-chat-labs/open-chat/pull/4126))

## [[2.0.765](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.765-local_group_index)] - 2023-07-29

### Removed

- Consolidate remove and block community permissions ([#4030](https://github.com/open-chat-labs/open-chat/pull/4030))

## [[2.0.751](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.751-local_group_index)] - 2023-07-20

### Added

- Add language field to community ([#3923](https://github.com/open-chat-labs/open-chat/pull/3923))

## [[2.0.732](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.732-local_group_index)] - 2023-06-27

### Added

- Implement converting a group into a community ([#3833](https://github.com/open-chat-labs/open-chat/pull/3833))

## [[2.0.704](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.704-local_group_index)] - 2023-06-01

### Added

- Integrate Communities ([#3656](https://github.com/open-chat-labs/open-chat/pull/3656))

## [[2.0.691](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.691-local_group_index)] - 2023-05-17

### Changed

- Added `moderator` role and removed `add_members` permission ([#3592](https://github.com/open-chat-labs/open-chat/pull/3592))
- Put back `add_members` permission with serde default ([#3599](https://github.com/open-chat-labs/open-chat/pull/3599))

## [[2.0.664](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.664-local_group_index)] - 2023-04-17

### Added

- Implement 'Gated Groups' ([#3406](https://github.com/open-chat-labs/open-chat/pull/3406))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-chat-labs/open-chat/pull/3375))

## [[2.0.648](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.648-local_group_index)] - 2023-02-24

### Added

- C2C endpoint for setting group upgrade concurrency ([#3268](https://github.com/open-chat-labs/open-chat/pull/3268))

### Changed

- Set upgrade concurrency to 10 ([#3302](https://github.com/open-chat-labs/open-chat/pull/3302))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248))
- Removed all the code around reinstalling groups ([#3253](https://github.com/open-chat-labs/open-chat/pull/3253))

## [[2.0.618](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.618-local_group_index)] - 2023-02-28

### Added

- Expose metrics about the current group being reinstalled ([#3194](https://github.com/open-chat-labs/open-chat/pull/3194))

### Changed

- Use `c2c_events_internal` when reinstalling groups ([#3216](https://github.com/open-chat-labs/open-chat/pull/3216))

## [[2.0.608](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.608-local_group_index)] - 2023-02-21

### Changed

- Speed up reinstalling groups by retrieving threads in batches ([#3177](https://github.com/open-chat-labs/open-chat/pull/3177))

## [[2.0.605](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.605-local_group_index)] - 2023-02-17

### Changed

- Increase batch size of getting events during reinstall ([#3161](https://github.com/open-chat-labs/open-chat/pull/3161))

## [[2.0.603](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.603-local_group_index)] - 2023-02-17

### Changed

- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-chat-labs/open-chat/pull/3158))

## [[2.0.602](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.602-local_group_index)] - 2023-02-17

### Added

- Added `c2c_reinstall_group` for recovering groups which are un-upgradable due to bug in `pre_upgrade` ([#3128](https://github.com/open-chat-labs/open-chat/pull/3128))
- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-chat-labs/open-chat/pull/3145))
- Reinstall groups using heartbeat but stop if any fail ([#3154](https://github.com/open-chat-labs/open-chat/pull/3154))

### Changed

- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-chat-labs/open-chat/pull/3152))

### Removed

- Removed code to initialize `proposals_bot_user_id` value ([#3124](https://github.com/open-chat-labs/open-chat/pull/3124))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-chat-labs/open-chat/pull/3143))

## [[2.0.588](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.588-local_group_index)] - 2023-02-10

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))
- Drop group canister stable memory after upgrade ([#3116](https://github.com/open-chat-labs/open-chat/pull/3116))

## [[2.0.582](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.582-local_group_index)] - 2023-02-09

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-chat-labs/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Pass in the ProposalsBot userId when initializing each Group ([#3080](https://github.com/open-chat-labs/open-chat/pull/3080))

## [[2.0.574](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.574-local_group_index)] - 2023-02-01

### Added

- Added `events_ttl` field to `c2c_create_group` args for setting the 'time to live' for disappearing messages ([#3029](https://github.com/open-chat-labs/open-chat/pull/3029))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))

## [[2.0.557](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.557-local_group_index)] - 2023-01-23

### Changed

- Simplify code by using shared `UpgradeCanisterWasmArgs` ([#2990](https://github.com/open-chat-labs/open-chat/pull/2990))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))

### Removed

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-chat-labs/open-chat/pull/2954))
