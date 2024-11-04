# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Trigger migrating User events to stable memory using canister timer job ([#6671](https://github.com/open-chat-labs/open-chat/pull/6671))

### Changed

- Set the derivation origin when checking verifiable credentials ([#6703](https://github.com/open-chat-labs/open-chat/pull/6703))

## [[2.0.1411](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1411-local_user_index)] - 2024-10-24

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))
- Add more achievements ([#6631](https://github.com/open-chat-labs/open-chat/pull/6631))
- Expose count of User canisters per build version ([#6659](https://github.com/open-chat-labs/open-chat/pull/6659))

### Changed

- Maintain set of which canisters have not yet migrated all events to stable memory ([#6603](https://github.com/open-chat-labs/open-chat/pull/6603))

### Removed

- Remove `is_bot` which has been supplanted by `user_type` ([#6650](https://github.com/open-chat-labs/open-chat/pull/6650))

### Fixed

- Determine whether c2c call should be retried based on response error ([#6640](https://github.com/open-chat-labs/open-chat/pull/6640))

## [[2.0.1379](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1379-local_user_index)] - 2024-10-10

### Added

- Add support for expiring access gates ([#6401](https://github.com/open-chat-labs/open-chat/pull/6401))

### Changed

- Implement `GroupedTimerJobQueue` and use it for pushing user events ([#6528](https://github.com/open-chat-labs/open-chat/pull/6528))

## [[2.0.1372](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1372-local_user_index)] - 2024-10-07

### Changed

- Add `CanisterWasmBytes` to reduce duplication ([#6480](https://github.com/open-chat-labs/open-chat/pull/6480))
- Clear wasm chunks once new wasm version has been set ([#6524](https://github.com/open-chat-labs/open-chat/pull/6524))

### Removed

- Remove `push_events_v2` which is no longer used ([#6502](https://github.com/open-chat-labs/open-chat/pull/6502))

## [[2.0.1362](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1362-local_user_index)] - 2024-09-30

### Added

- Support upgrading to large wasms by uploading in chunks ([#6453](https://github.com/open-chat-labs/open-chat/pull/6453))

### Changed

- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Simplify prize winner messages to reduce size (part 1) ([#6449](https://github.com/open-chat-labs/open-chat/pull/6449))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))

### Removed

- Remove the unused `use_for_new_canisters` field from upgrade args ([#6452](https://github.com/open-chat-labs/open-chat/pull/6452))

## [[2.0.1353](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1353-local_user_index)] - 2024-09-20

### Changed

- Add `winner_count` to prizes enabling us to stop sending all winners ([#6426](https://github.com/open-chat-labs/open-chat/pull/6426))

## [[2.0.1342](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1342-local_user_index)] - 2024-09-10

### Changed

- Allow video calls started by diamond members to last 2 hours ([#6356](https://github.com/open-chat-labs/open-chat/pull/6356))
- Allow paging failed user events ([#6360](https://github.com/open-chat-labs/open-chat/pull/6360))
- Add `community_canister_timestamp` to `UserJoinedCommunityOrChannel` events ([#6361](https://github.com/open-chat-labs/open-chat/pull/6361))

## [[2.0.1339](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1339-local_user_index)] - 2024-09-10

### Fixed

- Don't push events directly to users on other subnets ([#6355](https://github.com/open-chat-labs/open-chat/pull/6355))

## [[2.0.1338](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1338-local_user_index)] - 2024-09-10

### Added

- Expose MessagePack versions of LocalUserIndex APIs ([#6318](https://github.com/open-chat-labs/open-chat/pull/6318))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Support community referrals ([#6317](https://github.com/open-chat-labs/open-chat/pull/6317))

## [[2.0.1310](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1310-local_user_index)] - 2024-08-29

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

### Fixed

- Fix referrals sometimes not being recorded ([#6290](https://github.com/open-chat-labs/open-chat/pull/6290))

## [[2.0.1299](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1299-local_user_index)] - 2024-08-20

### Changed

- Add OC dev team controller to 2 uninstalled canisters to recover funds ([#6247](https://github.com/open-chat-labs/open-chat/pull/6247))
- Ensure referrer is known by user canister ([#6250](https://github.com/open-chat-labs/open-chat/pull/6250))

## [[2.0.1288](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1288-local_user_index)] - 2024-08-13

### Added

- Add `external_url` property to channel ([#6226](https://github.com/open-chat-labs/open-chat/pull/6226))

## [[2.0.1281](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1281-local_user_index)] - 2024-08-02

### Changed

- Remove canister which holds some tokens from the canister pool ([#6188](https://github.com/open-chat-labs/open-chat/pull/6188))

## [[2.0.1278](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1278-local_user_index)] - 2024-08-01

### Fixed

- Store unique person proof if submitted to LocalUserIndex ([#6174](https://github.com/open-chat-labs/open-chat/pull/6174))

## [[2.0.1277](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1277-local_user_index)] - 2024-08-01

### Fixed

- Fix submitting unique person proof via LocalUserIndex ([#6168](https://github.com/open-chat-labs/open-chat/pull/6168))
- Use correct principal when verifying credentials ([#6170](https://github.com/open-chat-labs/open-chat/pull/6170))
- Fix incorrect canister Id being used in place of Internet Identity canister Id ([#6171](https://github.com/open-chat-labs/open-chat/pull/6171))

## [[2.0.1274](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1274-local_user_index)] - 2024-07-31

### Changed

- Configure message visibility to non-members of public channels/groups ([#6152](https://github.com/open-chat-labs/open-chat/pull/6152))

## [[2.0.1268](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1268-local_user_index)] - 2024-07-30

### Changed

- Push unique person proofs to user canisters ([#6144](https://github.com/open-chat-labs/open-chat/pull/6144))

## [[2.0.1267](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1267-local_user_index)] - 2024-07-29

### Changed

- Remove canister holding some ckBTC from canister pool ([#6137](https://github.com/open-chat-labs/open-chat/pull/6137))

## [[2.0.1257](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1257-local_user_index)] - 2024-07-26

### Added

- Add `is_oc_controlled_bot` to `GlobalUser` ([#6115](https://github.com/open-chat-labs/open-chat/pull/6115))

### Changed

- Use `UserType` rather than `is_bot` and `is_oc_controlled_bot` ([#6116](https://github.com/open-chat-labs/open-chat/pull/6116))

### Removed

- Remove `Invited` gate ([#6112](https://github.com/open-chat-labs/open-chat/pull/6112))

## [[2.0.1256](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1256-local_user_index)] - 2024-07-25

### Added

- Support submitting proof of uniqueness to LocalUserIndex ([#6068](https://github.com/open-chat-labs/open-chat/pull/6068))
- Support submitting proof of diamond membership to LocalUserIndex ([#6084](https://github.com/open-chat-labs/open-chat/pull/6084))
- Add `Locked` gate ([#6095](https://github.com/open-chat-labs/open-chat/pull/6095))
- Add `Invited` gate ([#6106](https://github.com/open-chat-labs/open-chat/pull/6106))

### Changed

- Clear old data from the failed upgrades log ([#6062](https://github.com/open-chat-labs/open-chat/pull/6062))
- Use `P256KeyPair` rather than just storing the secret key bytes ([#6083](https://github.com/open-chat-labs/open-chat/pull/6083))

### Removed

- Remove a load of unused code ([#6066](https://github.com/open-chat-labs/open-chat/pull/6066))

## [[2.0.1247](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1247-local_user_index)] - 2024-07-18

### Changed

- Expire old BTC Miami referral codes ([#6053](https://github.com/open-chat-labs/open-chat/pull/6053))

## [[2.0.1241](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1241-local_user_index)] - 2024-07-17

### Added

- Support gates with multiple verifiable credentials ([#6029](https://github.com/open-chat-labs/open-chat/pull/6029))
- Reuse canisters of deleted empty and dormant users ([#6046](https://github.com/open-chat-labs/open-chat/pull/6046))

### Changed

- Store `unique_person_proof` in User canisters ([#6029](https://github.com/open-chat-labs/open-chat/pull/6029))
- Reuse existing uninstalled user canisters ([#6047](https://github.com/open-chat-labs/open-chat/pull/6047))

### Removed

- Remove deprecated `ChitEarned` event ([#6041](https://github.com/open-chat-labs/open-chat/pull/6041))

## [[2.0.1236](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1236-local_user_index)] - 2024-07-11

### Changed

- Added lots more achievements to enum ([#6020](https://github.com/open-chat-labs/open-chat/pull/6020))

### Fixed

- Fix `delete_users` job from stopping prematurely ([#6028](https://github.com/open-chat-labs/open-chat/pull/6028))

## [[2.0.1229](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1229-local_user_index)] - 2024-07-08

### Added

- Add `LifetimeDiamondMembership` access gate ([#5986](https://github.com/open-chat-labs/open-chat/pull/5986))
- Add `UniquePerson` access gate ([#5993](https://github.com/open-chat-labs/open-chat/pull/5993))
- Support composite access gates ([#5988](https://github.com/open-chat-labs/open-chat/pull/5988))

### Changed

- In `ChitEarnedReason::Achievement` replaced `String` with `Achievement` ([#5962](https://github.com/open-chat-labs/open-chat/pull/5962))
- Delete user accounts that are empty and dormant ([#5985](https://github.com/open-chat-labs/open-chat/pull/5985))

## [[2.0.1198](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1198-local_user_index)] - 2024-06-07

### Changed

- Increase user limit from 150,000 to 200,000 ([#5916](https://github.com/open-chat-labs/open-chat/pull/5916))

## [[2.0.1187](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1187-local_user_index)] - 2024-06-04

### Changed

- Add `credential_name` to verified credential access gates ([#5853](https://github.com/open-chat-labs/open-chat/pull/5853))
- Detect canisters that need cycles topped up when pushing events ([#5891](https://github.com/open-chat-labs/open-chat/pull/5891))

## [[2.0.1179](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1179-local_user_index)] - 2024-05-23

### Added

- Allow users to delete their accounts ([#5775](https://github.com/open-chat-labs/open-chat/pull/5775))
- New user event `ChitEarned` ([#5817](https://github.com/open-chat-labs/open-chat/pull/5817))
- Implement validation of verified credential gates ([#5825](https://github.com/open-chat-labs/open-chat/pull/5825))
- Add `ChitEarnedReason::MemeContestWinner` ([#5842](https://github.com/open-chat-labs/open-chat/pull/5842))

## [[2.0.1162](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1162-local_user_index)] - 2024-05-02

### Changed

- Ensure all new users register via the Identity canister ([#5748](https://github.com/open-chat-labs/open-chat/pull/5748))

## [[2.0.1145](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1145-local_user_index)] - 2024-04-23

### Changed

- Add `block_level_markdown` flag to messages ([#5680](https://github.com/open-chat-labs/open-chat/pull/5680))
- Update `event_store` packages to v0.1.0 ([#5715](https://github.com/open-chat-labs/open-chat/pull/5715))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

## [[2.0.1137](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1137-local_user_index)] - 2024-04-10

### Changed

- Update `event_store` packages to latest version ([#5593](https://github.com/open-chat-labs/open-chat/pull/5593))
- Include `call_type` in request to get video call access token ([#5662](https://github.com/open-chat-labs/open-chat/pull/5662))

### Fixed

- Prevent users registering twice with the same principal ([#5655](https://github.com/open-chat-labs/open-chat/pull/5655))

## [[2.0.1113](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1113-local_user_index)] - 2024-03-20

### Changed

- Update `event_store` packages to latest version ([#5535](https://github.com/open-chat-labs/open-chat/pull/5535))
- Anonymize all User canisters in events ([#5568](https://github.com/open-chat-labs/open-chat/pull/5568))
- Prevent bot users from being able to get video call access tokens ([#5573](https://github.com/open-chat-labs/open-chat/pull/5573))

### Fixed

- Fix upgrading from previous events format ([#5579](https://github.com/open-chat-labs/open-chat/pull/5579))

## [[2.0.1099](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1099-local_user_index)] - 2024-03-11

### Changed

- Pause upgrades if events queue becomes too large ([#5507](https://github.com/open-chat-labs/open-chat/pull/5507))

### Fixed

- Fix 'out of cycles' check to use new response code ([#5503](https://github.com/open-chat-labs/open-chat/pull/5503))

## [[2.0.1093](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1093-local_user_index)] - 2024-03-08

### Changed

- Include raw arg data in RNG seed used to sign access token ([#5465](https://github.com/open-chat-labs/open-chat/pull/5465))
- Add `start_video_call` permission ([#5488](https://github.com/open-chat-labs/open-chat/pull/5488))
- Use old OpenChat Bot message format until User canisters are upgraded ([#5492](https://github.com/open-chat-labs/open-chat/pull/5492))

### Fixed

- Populate username in 'Invited to group/community' notifications ([#5476](https://github.com/open-chat-labs/open-chat/pull/5476))

## [[2.0.1086](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1086-local_user_index)] - 2024-03-01

### Added

- Implement ability to push events from User canisters ([#5436](https://github.com/open-chat-labs/open-chat/pull/5436))

### Changed

- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Expose `event_sink_client_info` in metrics ([#5464](https://github.com/open-chat-labs/open-chat/pull/5464))

### Removed

- Remove `c2c_notify_events` ([#5430](https://github.com/open-chat-labs/open-chat/pull/5430))

## [[2.0.1079](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1079-local_user_index)] - 2024-02-22

### Fixed

- Fix chat summary updates ([#5423](https://github.com/open-chat-labs/open-chat/pull/5423))

## [[2.0.1070](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1070-local_user_index)] - 2024-02-22

### Added

- Add `access_token` endpoint + sync secret key ([#5398](https://github.com/open-chat-labs/open-chat/pull/5398))

### Changed

- Add `is_from_identity_canister` to `UserRegistered` events ([#5402](https://github.com/open-chat-labs/open-chat/pull/5402))
- Use `install_chunked_code` to upgrade User canisters ([#5412](https://github.com/open-chat-labs/open-chat/pull/5412))
- Fix `access_token` endpoint + integration test ([#5415](https://github.com/open-chat-labs/open-chat/pull/5415))

## [[2.0.1046](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1046-local_user_index)] - 2024-02-05

### Added

- VideoCall message + permission + summary/updates ([#5357](https://github.com/open-chat-labs/open-chat/pull/5357))

### Changed

- Handle `DiamondMembershipPaymentReceived` events from non-local users ([#5322](https://github.com/open-chat-labs/open-chat/pull/5322))
- Propagate video call operators ids for guarding ([#5374](https://github.com/open-chat-labs/open-chat/pull/5374))

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
