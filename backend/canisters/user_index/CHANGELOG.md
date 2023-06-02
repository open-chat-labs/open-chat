# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add `expiry` to referral codes ([#3705](https://github.com/open-ic/open-chat/pull/3705))

## [[2.0.709](https://github.com/open-ic/open-chat/releases/tag/v2.0.709-user_index)] - 2023-06-01

### Added

- Add `is_platform_moderator` to `current_user` response ([#3640](https://github.com/open-ic/open-chat/pull/3640))

## [[2.0.699](https://github.com/open-ic/open-chat/releases/tag/v2.0.699-user_index)] - 2023-05-18

### Added

- Added `JoinUserToGroup` event ([#3613](https://github.com/open-ic/open-chat/pull/3613))

### Changed

- Only retry transfers where the c2c call failed ([#3614](https://github.com/open-ic/open-chat/pull/3614))

### Removed

- Remove `register_user_v2` since users now register via a LocalUserIndex ([#3583](https://github.com/open-ic/open-chat/pull/3583))

## [[2.0.684](https://github.com/open-ic/open-chat/releases/tag/v2.0.684-user_index)] - 2023-05-10

### Fixed

- Fix incorrect calculation in backdated referral rewards ([#3562](https://github.com/open-ic/open-chat/pull/3562))

## [[2.0.683](https://github.com/open-ic/open-chat/releases/tag/v2.0.683-user_index)] - 2023-05-10

### Changed

- Restart payments job if final payment in queue fails ([#3551](https://github.com/open-ic/open-chat/pull/3551))
- Append a suffix when registering if username is taken ([#3553](https://github.com/open-ic/open-chat/pull/3553))
- Register users via LocalUserIndex to improve speed ([#3557](https://github.com/open-ic/open-chat/pull/3557))

### Fixed

- Fix the 'Top Referrers' leaderboard which has double counted referrals ([#3549](https://github.com/open-ic/open-chat/pull/3549))

## [[2.0.679](https://github.com/open-ic/open-chat/releases/tag/v2.0.679-user_index)] - 2023-05-08

### Changed

- Bitcoin Miami welcome messages ([#3532](https://github.com/open-ic/open-chat/pull/3532))

### Fixed

- Fix group invite messages ([#3543](https://github.com/open-ic/open-chat/pull/3543))

## [[2.0.673](https://github.com/open-ic/open-chat/releases/tag/v2.0.673-user_index)] - 2023-04-28

### Changed

- Pass OpenChat bot messages in user canister init args ([#3517](https://github.com/open-ic/open-chat/pull/3517))

## [[2.0.671](https://github.com/open-ic/open-chat/releases/tag/v2.0.671-user_index)] - 2023-04-28

### Added

- Expose user referral leaderboards ([#3482](https://github.com/open-ic/open-chat/pull/3482))
- Add `add_referral_codes` and `register_user_v2` endpoints to support BTC Miami ([#3485](https://github.com/open-ic/open-chat/pull/3485))
- Add each new platform moderator to a moderation group ([#3493](https://github.com/open-ic/open-chat/pull/3493))
- Added `platform_moderators_group` query endpoint ([#3495](https://github.com/open-ic/open-chat/pull/3495))
- Join users who register with relevant code to Bitcoin Miami group ([#3501](https://github.com/open-ic/open-chat/pull/3501))

### Changed

- Reduce a few timer job intervals ([#3515](https://github.com/open-ic/open-chat/pull/3515))

## [[2.0.668](https://github.com/open-ic/open-chat/releases/tag/v2.0.668-user_index)] - 2023-04-19

### Changed

- Share Diamond membership payment with referrer ([#3452](https://github.com/open-ic/open-chat/pull/3452))
- Send OpenChatBot welcome messages from the UserIndex ([#3478](https://github.com/open-ic/open-chat/pull/3478))

### Removed

- Remove one-time code to sync `diamond_membership_expires_at` with user canisters ([#3467](https://github.com/open-ic/open-chat/pull/3467))

## [[2.0.666](https://github.com/open-ic/open-chat/releases/tag/v2.0.666-user_index)] - 2023-04-17

### Changed

- Store `diamond_membership_expires_at` in each user canister ([#3428](https://github.com/open-ic/open-chat/pull/3428))

### Removed

- Remove code to handle the initial airdrop ([#3462](https://github.com/open-ic/open-chat/pull/3462))

### Fixed

- Fix `referral_metrics` endpoint ([#3461](https://github.com/open-ic/open-chat/pull/3461))

## [[2.0.661](https://github.com/open-ic/open-chat/releases/tag/v2.0.661-user_index)] - 2023-04-15

### Added

- Added `referral_metrics` endpoint ([#3429](https://github.com/open-ic/open-chat/pull/3429))

### Removed

- Removed `c2c_lookup_principal` ([#3414](https://github.com/open-ic/open-chat/pull/3414))
- Remove CAPTCHA and instead verify public key is derived from II canister ([#3426](https://github.com/open-ic/open-chat/pull/3426))

### Fixed

- Ensure only one airdrop neuron is created at a time ([#3458](https://github.com/open-ic/open-chat/pull/3458))

## [[2.0.656](https://github.com/open-ic/open-chat/releases/tag/v2.0.656-user_index)] - 2023-04-05

### Added

- Implement job to distribute initial airdrop neurons ([#3398](https://github.com/open-ic/open-chat/pull/3398))
- Added `is_diamond_member` to `c2c_lookup_user` ([#3408](https://github.com/open-ic/open-chat/pull/3408))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-ic/open-chat/pull/3375))

## [[2.0.649](https://github.com/open-ic/open-chat/releases/tag/v2.0.649-user_index)] - 2023-03-25

### Fixed

- Fix bug when joining group on a different subnet ([#3373](https://github.com/open-ic/open-chat/pull/3373))

## [[2.0.643](https://github.com/open-ic/open-chat/releases/tag/v2.0.643-user_index)] - 2023-03-24

### Changed

- Speed up `is_eligible_for_initial_airdrop` check ([#3345](https://github.com/open-ic/open-chat/pull/3345))

### Removed

- Removed super_admin role from groups([#3319](https://github.com/open-ic/open-chat/pull/3319))

## [[2.0.636](https://github.com/open-ic/open-chat/releases/tag/v2.0.636-user_index)] - 2023-03-14

### Added

- APIs to add/remove/list platform operators ([#3264](https://github.com/open-ic/open-chat/pull/3264)) 
- Endpoint for platform ops to set user upgrade concurrency ([#3268](https://github.com/open-ic/open-chat/pull/3268))
- Implemented recurring Diamond membership payments ([#3274](https://github.com/open-ic/open-chat/pull/3274))
- Expose more metrics about Diamond membership payments ([#3276](https://github.com/open-ic/open-chat/pull/3276))
- Added `caller_is_openchat_user` guard to a few endpoints ([#3279](https://github.com/open-ic/open-chat/pull/3279))
- Added endpoints to collect neuron controllers for the initial airdrop ([#3287](https://github.com/open-ic/open-chat/pull/3287))

### Changed

- Use `canister_timer_jobs` package to simplify timer jobs ([#3263](https://github.com/open-ic/open-chat/pull/3263)) 
- Increased user limit to 150,000 ([#3267](https://github.com/open-ic/open-chat/pull/3267))

### Removed

- Removed code only needed for previous upgrade ([#3262](https://github.com/open-ic/open-chat/pull/3262))
- Removed `set_governance_principals` ([#3301](https://github.com/open-ic/open-chat/pull/3301))

### Fixed

- Ensure job to sync events to local user indexes always runs ([#3295](https://github.com/open-ic/open-chat/pull/3295))

## [[2.0.623](https://github.com/open-ic/open-chat/releases/tag/v2.0.623-user_index)] - 2023-03-02

### Changed

- Renamed super_admin endpoints to platform_moderator ([#3249](https://github.com/open-ic/open-chat/pull/3249))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-ic/open-chat/pull/3248)) & ([#3251](https://github.com/open-ic/open-chat/pull/3251))
- Revert code to register each LocalGroupIndex as a user ([#3255](https://github.com/open-ic/open-chat/pull/3255))

## [[2.0.615](https://github.com/open-ic/open-chat/releases/tag/v2.0.615-user_index)] - 2023-02-28

### Changed

- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-ic/open-chat/pull/3152))
- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-ic/open-chat/pull/3158))
- Upgrade LocalUserIndex canisters using a timer job rather than heartbeat ([#3229](https://github.com/open-ic/open-chat/pull/3229))
- Switch to using canister timers instead of heartbeat ([#3230](https://github.com/open-ic/open-chat/pull/3230))

### Removed

- Remove one time code to set up `GroupUpgradeBot` users  ([#3159](https://github.com/open-ic/open-chat/pull/3159))

## [[2.0.594](https://github.com/open-ic/open-chat/releases/tag/v2.0.594-user_index)] - 2023-02-16

### Added

- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-ic/open-chat/pull/3145))

### Changed

- Registered each LocalGroupIndex as a bot user ([#3128](https://github.com/open-ic/open-chat/pull/3128))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-ic/open-chat/pull/3133))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## [[2.0.590](https://github.com/open-ic/open-chat/releases/tag/v2.0.590-user_index)] - 2023-02-10

### Added

- Diamond metrics ([#3117](https://github.com/open-ic/open-chat/pull/3117))

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))

### Removed

- Removed code for upgrading storage and confirming phone number ([#3110](https://github.com/open-ic/open-chat/pull/3110))
- Removed one time code to sync users to OpenStorage ([#3114](https://github.com/open-ic/open-chat/pull/3114))

## [[2.0.584](https://github.com/open-ic/open-chat/releases/tag/v2.0.584-user_index)] - 2023-02-09

### Changed

- Push all users to OpenStorage with the new storage limits ([#3104](https://github.com/open-ic/open-chat/pull/3104))

### Removed

- Removed code only needed for the previous upgrade ([#3102](https://github.com/open-ic/open-chat/pull/3102))

## [[2.0.580](https://github.com/open-ic/open-chat/releases/tag/v2.0.580-user_index)] - 2023-02-09

### Added

- Added `pay_for_diamond_membership` ([#3069](https://github.com/open-ic/open-chat/pull/3069))

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-ic/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))
- Remove captcha challenge after any attempt ([#3078](https://github.com/open-ic/open-chat/pull/3078))
- Mark user as updated after taking Diamond membership payment ([#3081](https://github.com/open-ic/open-chat/pull/3081))
- Give all verified users 12 months Diamond membership ([#3082](https://github.com/open-ic/open-chat/pull/3082))

### Fixed
- Fix c2c_register_bot so it queues UserRegistered ([#3086](https://github.com/open-ic/open-chat/pull/3086))
- Fix username uniqueness check to include reserved usernames ([#3088](https://github.com/open-ic/open-chat/pull/3088))

## [[2.0.570](https://github.com/open-ic/open-chat/releases/tag/v2.0.570-user_index)] - 2023-02-01

### Added

- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-ic/open-chat/pull/3038))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))

## [[2.0.558](https://github.com/open-ic/open-chat/releases/tag/v2.0.558-user_index)] - 2023-01-23

### Added

- Expose validation methods for functions that will be called via proposals ([#2990](https://github.com/open-ic/open-chat/pull/2990))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))

## [[2.0.544](https://github.com/open-ic/open-chat/releases/tag/v2.0.544-user_index)] - 2023-01-08

### Added

- Added `c2c_notify_events` for receiving events from local user indexes ([#2955](https://github.com/open-ic/open-chat/pull/2955))

### Fixed

- Free up username if registration fails ([#2952](https://github.com/open-ic/open-chat/pull/2952))
