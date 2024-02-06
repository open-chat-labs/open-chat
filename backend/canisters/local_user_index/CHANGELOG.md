# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1046](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1046-local_user_index)] - 2024-02-05

### Changed

- Handle `DiamondMembershipPaymentReceived` events from non-local users ([#5322](https://github.com/open-chat-labs/open-chat/pull/5322))

## [[2.0.1041](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1041-local_user_index)] - 2024-02-02

### Changed

- Add `timestamp` to `chat_events` responses ([#5309](https://github.com/open-chat-labs/open-chat/pull/5309))

## [[2.0.1031](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1031-local_user_index)] - 2024-01-25

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))

### Changed

- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))

## [[2.0.1019](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1019-local_user_index)] - 2024-01-24

### Changed

- Upgrade Diamond members first ([#5214](https://github.com/open-chat-labs/open-chat/pull/5214))
- Simplify timer jobs + make them more efficient ([#5233](https://github.com/open-chat-labs/open-chat/pull/5233))
- Avoid setting up canister timer unless job already in progress ([#5243](https://github.com/open-chat-labs/open-chat/pull/5243))

### Removed

- Remove `DiamondMembershipExpiryDate` event which is no longer needed ([#5245](https://github.com/open-chat-labs/open-chat/pull/5245))

## [[2.0.1011](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1011-local_user_index)] - 2024-01-18

### Added

- Add TokenBalance access gate ([#5120](https://github.com/open-chat-labs/open-chat/pull/5120))
- Add Escrow canister Id to metrics ([#5202](https://github.com/open-chat-labs/open-chat/pull/5202))

### Changed

- Ensure swap responses contain all transaction ids ([#5174](https://github.com/open-chat-labs/open-chat/pull/5174))
- Use "swap" instead of "trade" in vars and types ([#5175](https://github.com/open-chat-labs/open-chat/pull/5175))

## [[2.0.976](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.976-local_user_index)] - 2023-12-19

### Added

- Support getting batches of summary updates via LocalUserIndex ([#4983](https://github.com/open-chat-labs/open-chat/pull/4983))
- Add `c2c_diamond_membership_expiry_dates` ([#5036](https://github.com/open-chat-labs/open-chat/pull/5036))

### Changed

- Add `escrow_canister_id` to User canister init args ([#4897](https://github.com/open-chat-labs/open-chat/pull/4897))
- Store Diamond membership expiry dates in LocalUserIndex canisters ([#5025](https://github.com/open-chat-labs/open-chat/pull/5025))
- Make Diamond membership gate check synchronous ([#5027](https://github.com/open-chat-labs/open-chat/pull/5027))

### Fixed

- Fix incorrect `local_user_index_canister_id` values ([#5009](https://github.com/open-chat-labs/open-chat/pull/5009))

## [[2.0.959](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.959-local_user_index)] - 2023-12-05

### Added

- Introduce `Lifetime Diamond Membership` ([#4876](https://github.com/open-chat-labs/open-chat/pull/4876))

### Changed

- Remove `display_name` from `register_user` args ([#4910](https://github.com/open-chat-labs/open-chat/pull/4910))

## [[2.0.948](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.948-local_user_index)] - 2023-11-28

### Added

- Support getting batches of chat events via LocalUserIndex ([#4848](https://github.com/open-chat-labs/open-chat/pull/4848))

### Changed

- Add `local_user_index_canister_id` to group/community summaries ([#4857](https://github.com/open-chat-labs/open-chat/pull/4857))

## [[2.0.943](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.943-local_user_index)] - 2023-11-24

### Changed

- Add crypto payment access gate ([#4823](https://github.com/open-chat-labs/open-chat/pull/4823))

## [[2.0.940](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.940-local_user_index)] - 2023-11-21

### Changed

- Refund ckBTC which Dfinity provided for the Bitcoin Miami promotion ([#4795](https://github.com/open-chat-labs/open-chat/pull/4795))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))

## [[2.0.936](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.936-local_user_index)] - 2023-11-16

### Changed

- Add `events_ttl_last_updated` to chat summaries ([#4711](https://github.com/open-chat-labs/open-chat/pull/4711))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))

## [[2.0.924](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.924-local_user_index)] - 2023-11-03

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))

### Removed

- Removed old permissions code ([#4667](https://github.com/open-chat-labs/open-chat/pull/4667))

## [[2.0.906](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.906-local_user_index)] - 2023-10-27

### Added

- Add `permissions_v2` to group/channel summary ([#4620](https://github.com/open-chat-labs/open-chat/pull/4620))

## [[2.0.895](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.895-local_user_index)] - 2023-10-19

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

## [[2.0.878](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.878-local_user_index)] - 2023-10-09

### Removed

- Remove `report_message` which has been superseded by `report_message_v2` ([#4524](https://github.com/open-chat-labs/open-chat/pull/4524))

### Fixed

- Fix 'Report message' functionality ([#4523](https://github.com/open-chat-labs/open-chat/pull/4523))

## [[2.0.872](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.872-local_user_index)] - 2023-10-05

### Added

- Add a welcome message to help new users discover communities ([#4484](https://github.com/open-chat-labs/open-chat/pull/4484))

### Changed

- Store `proposals_bot_canister_id` in user canisters ([#4485](https://github.com/open-chat-labs/open-chat/pull/4485))

## [[2.0.860](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.860-local_user_index)] - 2023-09-26

### Added

- Add `mention_all_members` group permission ([#4405](https://github.com/open-chat-labs/open-chat/pull/4405))

## [[2.0.847](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.847-local_user_index)] - 2023-09-18

### Changed

- One time job to remove bot users from the set of local users ([#4301](https://github.com/open-chat-labs/open-chat/pull/4301))
- Move rules enabled into Details response + related ([#4366](https://github.com/open-chat-labs/open-chat/pull/4366))

## [[2.0.834](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.834-local_user_index)] - 2023-09-04

### Added

- Expose `user_canister_versions` from LocalUserIndex canisters ([#4293](https://github.com/open-chat-labs/open-chat/pull/4293))

## [[2.0.826](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.826-local_user_index)] - 2023-09-01

### Added

- Add optional user `display name` ([#4247](https://github.com/open-chat-labs/open-chat/pull/4247))
- Implement ability to create and update `user_groups` ([#4271](https://github.com/open-chat-labs/open-chat/pull/4271))

### Changed

- Consolidate and simplify user/group/community name validation ([#4265](https://github.com/open-chat-labs/open-chat/pull/4265))

## [[2.0.819](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.819-local_user_index)] - 2023-08-24

### Changed

- Improve upgrade version check to support multiple active versions ([#4215](https://github.com/open-chat-labs/open-chat/pull/4215))
- Extend versioned rules to communities and groups ([#4219](https://github.com/open-chat-labs/open-chat/pull/4219))

## [[2.0.805](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.805-local_user_index)] - 2023-08-11

### Changed

- Add support for versioned access rules ([#4159](https://github.com/open-chat-labs/open-chat/pull/4159))

### Removed

- Remove SNS transaction types ([#4162](https://github.com/open-chat-labs/open-chat/pull/4162))

## [[2.0.799](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.799-local_user_index)] - 2023-08-08

### Changed

- Switch referral payments over to using ICRC1 ([#4132](https://github.com/open-chat-labs/open-chat/pull/4132))
- Bump number of cycles required for upgrade ([#4155](https://github.com/open-chat-labs/open-chat/pull/4155))

## [[2.0.767](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.767-local_user_index)] - 2023-07-31

### Changed

- Replace links to OC groups with link to OC community in welcome messages ([#4060](https://github.com/open-chat-labs/open-chat/pull/4060))

## [[2.0.761](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.761-local_user_index)] - 2023-07-28

### Changed

- Mark channels as read after joining community or channel ([#4004](https://github.com/open-chat-labs/open-chat/pull/4004))

## [[2.0.752](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.752-local_user_index)] - 2023-07-20

### Changed

- Remove dependencies on IC repo ([#3970](https://github.com/open-chat-labs/open-chat/pull/3970))
- Allow users to join community and channel in a single call ([#3988](https://github.com/open-chat-labs/open-chat/pull/3988))
- Allow inviting non-community members directly into a channel ([#3990](https://github.com/open-chat-labs/open-chat/pull/3990))
- Handle `join_channel` in `inspect_message` ([#3994](https://github.com/open-chat-labs/open-chat/pull/3994))

### Removed

- Consolidate remove and block community permissions ([#4030](https://github.com/open-chat-labs/open-chat/pull/4030))

## [[2.0.741](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.741-local_user_index)] - 2023-07-07

### Changed

- Set up name change from 'SuperAdmin' to 'PlatformModerator' ([#3863](https://github.com/open-chat-labs/open-chat/pull/3863))

### Fixed

- Fix group URLs in the OpenChatBot messages for new users ([#3941](https://github.com/open-chat-labs/open-chat/pull/3941))

## [[2.0.731](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.731-local_user_index)] - 2023-06-27

### Added

- Add `report_message_v2` to handle groups and channels ([#3842](https://github.com/open-chat-labs/open-chat/pull/3842))

### Changed

- Add 'group' prefix to group invite links ([#3828](https://github.com/open-chat-labs/open-chat/pull/3828))

## [[2.0.715](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.715-local_user_index)] - 2023-06-07

### Changed

- Reinstate code for the Bitcoin Miami promo ([#3741](https://github.com/open-chat-labs/open-chat/pull/3741))

## [[2.0.714](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.714-local_user_index)] - 2023-06-02

### Changed

- Temporarily re-add deprecated `is_super_admin` field ([#3717](https://github.com/open-chat-labs/open-chat/pull/3717))

## [[2.0.712](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.712-local_user_index)] - 2023-06-02

### Added

- Integrate Communities ([#3666](https://github.com/open-chat-labs/open-chat/pull/3666)), ([#3669](https://github.com/open-chat-labs/open-chat/pull/3669))
- Add `expiry` to referral codes ([#3705](https://github.com/open-chat-labs/open-chat/pull/3705))

### Changed

- End the BtcMiami promo ([#3705](https://github.com/open-chat-labs/open-chat/pull/3705))

### Removed

- Remove out of date welcome message ([#3618](https://github.com/open-chat-labs/open-chat/pull/3618))

## [[2.0.700](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.700-local_user_index)] - 2023-05-18

### Added

- Send ckBTC to the SatoshiDice bot for Bitcoin Miami ([#3616](https://github.com/open-chat-labs/open-chat/pull/3616))

### Changed

- Join users to groups via the UserIndex rather than directly ([#3613](https://github.com/open-chat-labs/open-chat/pull/3613))

### Removed

- Remove `JoinUserToGroup` event ([#3613](https://github.com/open-chat-labs/open-chat/pull/3613))

## [[2.0.694](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.694-local_user_index)] - 2023-05-17

### Added

- Register new Bitcoin Miami users with the SatoshiDice bot ([#3591](https://github.com/open-chat-labs/open-chat/pull/3591))

## [[2.0.687](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.687-local_user_index)] - 2023-05-12

### Added

- Re-introduce invite by code on backend ([#3552](https://github.com/open-chat-labs/open-chat/pull/3552))

### Changed

- Register users via LocalUserIndex to improve speed ([#3557](https://github.com/open-chat-labs/open-chat/pull/3557))
- Make BTC Miami promo work on test and on prod ([#3565](https://github.com/open-chat-labs/open-chat/pull/3565))
- Update BTC Miami welcome messages ([#3566](https://github.com/open-chat-labs/open-chat/pull/3566))
- Return `icp_account` in `register_user` responses ([#3581](https://github.com/open-chat-labs/open-chat/pull/3581))

## [[2.0.681](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.681-local_user_index)] - 2023-05-08

### Fixed

- One time fix for currently pending group invites ([#3548](https://github.com/open-chat-labs/open-chat/pull/3548))

## [[2.0.680](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.680-local_user_index)] - 2023-05-08

### Fixed

- Fix group invite messages ([#3543](https://github.com/open-chat-labs/open-chat/pull/3543))

## [[2.0.674](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.674-local_user_index)] - 2023-04-28

### Added

- Added ability to `report_message` ([#3497](https://github.com/open-chat-labs/open-chat/pull/3497))
- Supports inviting of specific users ([#3499](https://github.com/open-chat-labs/open-chat/pull/3499))

### Changed

- Encapsulate pushing events and starting sync job ([#3452](https://github.com/open-chat-labs/open-chat/pull/3452))
- Reduce a few timer job intervals ([#3515](https://github.com/open-chat-labs/open-chat/pull/3515))
- Pass OpenChat bot messages in user canister init args ([#3517](https://github.com/open-chat-labs/open-chat/pull/3517))

## [[2.0.663](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.663-local_user_index)] - 2023-04-17

### Added

- Implement 'Gated Groups' ([#3406](https://github.com/open-chat-labs/open-chat/pull/3406))

### Changed

- Store `diamond_membership_expires_at` in each user canister ([#3428](https://github.com/open-chat-labs/open-chat/pull/3428))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-chat-labs/open-chat/pull/3375))

## [[2.0.646](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.646-local_user_index)] - 2023-03-27

### Changed

- Pass is_platform_moderator to group::c2c_join_group ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))

### Removed

- Remove owner_id from group summary ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))

## [[2.0.634](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.634-local_user_index)] - 2023-03-14

### Added

- Event for setting user upgrade concurrency ([#3268](https://github.com/open-chat-labs/open-chat/pull/3268))
- Added `OpenChatBotMessage` event type ([#3274](https://github.com/open-chat-labs/open-chat/pull/3274))
- Return group summary if user tries to join group they are already in ([#3296](https://github.com/open-chat-labs/open-chat/pull/3296))

### Changed

- Switch to using the new `c2c_notify_events` endpoint ([#3283](https://github.com/open-chat-labs/open-chat/pull/3283))
- Set upgrade concurrency to 10 ([#3302](https://github.com/open-chat-labs/open-chat/pull/3302))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248))
- Removed super_admin role from groups([#3319](https://github.com/open-chat-labs/open-chat/pull/3319))

## [[2.0.616](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.616-local_user_index)] - 2023-02-28

### Changed

- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-chat-labs/open-chat/pull/3152))
- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-chat-labs/open-chat/pull/3158))
- Allow both users and user canisters to pass the `is_caller_openchat_user` guard ([#3163](https://github.com/open-chat-labs/open-chat/pull/3163))

## [[2.0.595](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.595-local_user_index)] - 2023-02-16

### Added

- Added `c2c_user_principals` for looking up the principals of multiple users at a time ([#3128](https://github.com/open-chat-labs/open-chat/pull/3128))
- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-chat-labs/open-chat/pull/3145))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-chat-labs/open-chat/pull/3143))

## [[2.0.592](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.592-local_user_index)] - 2023-02-11

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))
- Drop user canister stable memory after upgrade ([#3116](https://github.com/open-chat-labs/open-chat/pull/3116))

## [[2.0.587](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.587-local_user_index)] - 2023-02-10

### Added

- Added `DiamondMembershipPaymentReceived` event type ([#3069](https://github.com/open-chat-labs/open-chat/pull/3069))

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-chat-labs/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))

## [[2.0.573](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.573-local_user_index)] - 2023-02-01

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))
- Remove one time fix to user date created ([#2994](https://github.com/open-chat-labs/open-chat/pull/2994))

## [[2.0.563](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.563-local_user_index)] - 2023-01-23

### Changed

- Simplify code by using shared `UpgradeCanisterWasmArgs` ([#2990](https://github.com/open-chat-labs/open-chat/pull/2990))

## [[2.0.554](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.554-local_user_index)] - 2023-01-20

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))

## [[2.0.545](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.545-local_user_index)] - 2023-01-08

### Added

- Added `join_group` which avoids having to wait for any inter subnet updates ([#2955](https://github.com/open-chat-labs/open-chat/pull/2955))
- Added `c2c_notify_events` which deprecates `c2c_notify_user_index_events` ([#2955](https://github.com/open-chat-labs/open-chat/pull/2955))

### Changed

- Reduce log level of job started / stopped messages ([#2951](https://github.com/open-chat-labs/open-chat/pull/2951))

### Removed

- Removed one-time code only needed for initializing the first local user index ([#2953](https://github.com/open-chat-labs/open-chat/pull/2953))
- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-chat-labs/open-chat/pull/2954))
