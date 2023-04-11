# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Removed

- Removed `c2c_lookup_principal` ([#3414](https://github.com/open-ic/open-chat/pull/3414))
- Remove CAPTCHA and instead verify public key is derived from II canister ([#3426](https://github.com/open-ic/open-chat/pull/3426))

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
