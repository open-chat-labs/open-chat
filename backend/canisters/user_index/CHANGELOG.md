# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))
- Add more achievements ([#6631](https://github.com/open-chat-labs/open-chat/pull/6631))

### Changed

- Don't remove external achievements on expiry ([#6588](https://github.com/open-chat-labs/open-chat/pull/6588))
- Allow external achievements to be updated ([#6672](https://github.com/open-chat-labs/open-chat/pull/6672))

### Fixed

- Fix `last_updated` field of `external_achievements` ([#6667](https://github.com/open-chat-labs/open-chat/pull/6667))

## [[2.0.1384](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1384-user_index)] - 2024-10-11

### Added

- Add support for expiring access gates ([#6401](https://github.com/open-chat-labs/open-chat/pull/6401))

## [[2.0.1371](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1371-user_index)] - 2024-10-07

### Changed

- Clear wasm chunks once new wasm version has been set ([#6524](https://github.com/open-chat-labs/open-chat/pull/6524))

### Removed

- Remove unused fields from metrics ([#6525](https://github.com/open-chat-labs/open-chat/pull/6525))

## [[2.0.1368](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1368-user_index)] - 2024-10-02

### Added

- Expose counts of how many users have each streak badge ([#6492](https://github.com/open-chat-labs/open-chat/pull/6492))
- Register `Konecta` external achievement ([#6493](https://github.com/open-chat-labs/open-chat/pull/6493))

### Changed

- Add `CanisterWasmBytes` to reduce duplication ([#6480](https://github.com/open-chat-labs/open-chat/pull/6480))
- Log error if chunked User upgrade fails ([#6483](https://github.com/open-chat-labs/open-chat/pull/6483))

## [[2.0.1361](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1361-user_index)] - 2024-09-30

### Added

- Support upgrading to large wasms by uploading in chunks ([#6453](https://github.com/open-chat-labs/open-chat/pull/6453))
- Reinstate some candid endpoints ([#6468](https://github.com/open-chat-labs/open-chat/pull/6468))

### Changed

- No auth check for `award_external_achievement` in test mode ([#6397](https://github.com/open-chat-labs/open-chat/pull/6397))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))

### Removed

- Remove deprecated candid endpoints ([#6396](https://github.com/open-chat-labs/open-chat/pull/6396))
- Remove `create_challenge` ([#6409](https://github.com/open-chat-labs/open-chat/pull/6409))
- Remove the unused `use_for_new_canisters` field from upgrade args ([#6452](https://github.com/open-chat-labs/open-chat/pull/6452))

### Fixed

- Fix `award_external_achievement` ([#6408](https://github.com/open-chat-labs/open-chat/pull/6408))

## [[2.0.1346](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1346-user_index)] - 2024-09-12

### Changed

- Extend `chit_leaderboard` to return all_time|this_month|last_month ([#6364](https://github.com/open-chat-labs/open-chat/pull/6364))
- Add `register_external_achievement` to `inspect_message` ([#6374](https://github.com/open-chat-labs/open-chat/pull/6374))

## [[2.0.1345](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1345-user_index)] - 2024-09-11

### Changed

- Extended support for external achievements ([#6367](https://github.com/open-chat-labs/open-chat/pull/6367))
- Send a survey to some recently joined active users ([#6368](https://github.com/open-chat-labs/open-chat/pull/6368))

## [[2.0.1341](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1341-user_index)] - 2024-09-10

### Added

- Add support for external achievements ([#6350](https://github.com/open-chat-labs/open-chat/pull/6350))

### Changed

- Add `community_canister_timestamp` to `UserJoinedCommunityOrChannel` events ([#6361](https://github.com/open-chat-labs/open-chat/pull/6361))

### Fixed

- Replay referral reward events in case any were missed ([#6362](https://github.com/open-chat-labs/open-chat/pull/6362))

## [[2.0.1336](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1336-user_index)] - 2024-09-07

### Added

- Send survey to selected users ([#6334](https://github.com/open-chat-labs/open-chat/pull/6334))

## [[2.0.1331](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1331-user_index)] - 2024-09-06

### Added

- Expose MessagePack versions of UserIndex APIs ([#6318](https://github.com/open-chat-labs/open-chat/pull/6318))

## [[2.0.1329](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1329-user_index)] - 2024-09-03

### Changed

- Add airdrop eligibility metrics ([#6312](https://github.com/open-chat-labs/open-chat/pull/6312))
- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))

## [[2.0.1313](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1313-user_index)] - 2024-09-02

### Changed

- Mark ProposalsBot as OC controlled bot ([#6287](https://github.com/open-chat-labs/open-chat/pull/6287))
- Add metrics about recently joined users ([#6305](https://github.com/open-chat-labs/open-chat/pull/6305))

## [[2.0.1302](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1302-user_index)] - 2024-08-22

### Changed

- Sync referrers and referrals with users ([#6250](https://github.com/open-chat-labs/open-chat/pull/6250))
- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1293](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1293-user_index)] - 2024-08-16

### Changed

- Replace `chit_balances` with `users_chit` which includes streak ([#6238](https://github.com/open-chat-labs/open-chat/pull/6238))
- Remove references to deleted users ([#6241](https://github.com/open-chat-labs/open-chat/pull/6241))

### Removed

- Remove user referral leaderboard ([#6245](https://github.com/open-chat-labs/open-chat/pull/6245))

## [[2.0.1291](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1291-user_index)] - 2024-08-14

### Added

- Add `bot_config` to bot users ([#6220](https://github.com/open-chat-labs/open-chat/pull/6220))
- Expose JSON versions of UserIndex APIs + generate Typescript bindings ([#6225](https://github.com/open-chat-labs/open-chat/pull/6225))

### Removed

- Remove deprecated `is_bot` field from user records ([#6219](https://github.com/open-chat-labs/open-chat/pull/6219))

### Fixed

- Fix `is_deleted` check to only return true if userId hasn't been reused ([#6235](https://github.com/open-chat-labs/open-chat/pull/6235))

## [[2.0.1284](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1284-user_index)] - 2024-08-06

### Added

- Transfer airdrop funds to the AirdropBot ([#6199](https://github.com/open-chat-labs/open-chat/pull/6199))

## [[2.0.1280](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1280-user_index)] - 2024-08-02

### Added

- Remove deleted users from OnlineUsers canister ([#6179](https://github.com/open-chat-labs/open-chat/pull/6179))

### Changed

- Add logging to find deleted account with OGY tokens ([#6177](https://github.com/open-chat-labs/open-chat/pull/6177))
- Return deleted users in `users` response ([#6182](https://github.com/open-chat-labs/open-chat/pull/6182))
- Use total CHIT earned for the leaderboard ([#6185](https://github.com/open-chat-labs/open-chat/pull/6185))

## [[2.0.1279](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1279-user_index)] - 2024-08-01

### Fixed

- Push recent uniqueness proofs to LocalUserIndexes ([#6175](https://github.com/open-chat-labs/open-chat/pull/6175))

## [[2.0.1269](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1269-user_index)] - 2024-07-30

### Fixed

- Ensure `date_updated` is non-zero for all users ([#6146](https://github.com/open-chat-labs/open-chat/pull/6146))

## [[2.0.1266](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1266-user_index)] - 2024-07-29

### Fixed

- Bump `date_updated` after submitting proof of uniqueness ([#6135](https://github.com/open-chat-labs/open-chat/pull/6135))

## [[2.0.1265](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1265-user_index)] - 2024-07-29

### Changed

- Register the AirdropBot user ([#6129](https://github.com/open-chat-labs/open-chat/pull/6129))

### Fixed

- Fix empty `ic_root_key` ([#6134](https://github.com/open-chat-labs/open-chat/pull/6134))

## [[2.0.1258](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1258-user_index)] - 2024-07-26

### Added

- Special case registration of airdrop bot ([#6088](https://github.com/open-chat-labs/open-chat/pull/6088))

### Changed

- Set `is_oc_controlled_bot` to true when registering the ProposalsBot ([#6115](https://github.com/open-chat-labs/open-chat/pull/6115))
- Use `UserType` rather than `is_bot` and `is_oc_controlled_bot` ([#6116](https://github.com/open-chat-labs/open-chat/pull/6116))

## [[2.0.1255](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1255-user_index)] - 2024-07-25

### Added

- Return proof as JWT after paying for Diamond membership ([#6078](https://github.com/open-chat-labs/open-chat/pull/6078))

### Changed

- Use `should_retry_failed_c2c_call` to avoid getting stuck in loop ([#6061](https://github.com/open-chat-labs/open-chat/pull/6061))
- Clear old data from the failed upgrades log ([#6062](https://github.com/open-chat-labs/open-chat/pull/6062))
- Fix fee then retry transfer if fee too high ([#6063](https://github.com/open-chat-labs/open-chat/pull/6063))
- Handle transfer fee changing in either direction ([#6064](https://github.com/open-chat-labs/open-chat/pull/6064))
- Accept proofs of uniqueness from LocalUserIndexes ([#6068](https://github.com/open-chat-labs/open-chat/pull/6068))
- Ensure UserIndex is only controller before installing LocalUserIndex ([#6070](https://github.com/open-chat-labs/open-chat/pull/6070))
- Store CHIT balances per month ([#6087](https://github.com/open-chat-labs/open-chat/pull/6087))
- Add `user_ii_principal` to `submit_proof_of_unique_personhood` args ([#6092](https://github.com/open-chat-labs/open-chat/pull/6092))
- Bump `ic-verifiable-credentials` to latest version ([#6096](https://github.com/open-chat-labs/open-chat/pull/6096))
- Simplify `chit_balances` responses ([#6107](https://github.com/open-chat-labs/open-chat/pull/6107))

### Removed

- Remove deprecated `recurring` field ([#6077](https://github.com/open-chat-labs/open-chat/pull/6077))

## [[2.0.1242](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1242-user_index)] - 2024-07-17

### Added

- Sync userIds to Identity canister ([#6027](https://github.com/open-chat-labs/open-chat/pull/6027))
- Add `is_unique_person` field to user responses ([#6040](https://github.com/open-chat-labs/open-chat/pull/6040))
- Auto delete users who get flagged as being empty and dormant ([#6046](https://github.com/open-chat-labs/open-chat/pull/6046))

### Changed

- Reuse existing uninstalled user canisters ([#6047](https://github.com/open-chat-labs/open-chat/pull/6047))

## [[2.0.1235](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1235-user_index)] - 2024-07-11

### Added

- Uninstall canisters of empty users ([#6018](https://github.com/open-chat-labs/open-chat/pull/6018))
- Add `submit_proof_of_unique_personhood` ([#6023](https://github.com/open-chat-labs/open-chat/pull/6023))

### Changed

- Track event each time a proof of uniqueness is submitted ([#6024](https://github.com/open-chat-labs/open-chat/pull/6024))
- Track event each time a user is deleted ([#6025](https://github.com/open-chat-labs/open-chat/pull/6025))

## [[2.0.1231](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1231-user_index)] - 2024-07-08

### Fixed

- Fix `chitbands` endpoint ([#6007](https://github.com/open-chat-labs/open-chat/pull/6007))

## [[2.0.1227](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1227-user_index)] - 2024-07-08

### Added

- Store `unique_person_proof` alongside each relevant account ([#5993](https://github.com/open-chat-labs/open-chat/pull/5993))
- CHIT histogram endpoint to determine airdrop bands ([#5994](https://github.com/open-chat-labs/open-chat/pull/5994))

## [[2.0.1225](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1225-user_index)] - 2024-07-04

### Changed

- Fix CHIT leaderboard in post_upgrade ([#5991](https://github.com/open-chat-labs/open-chat/pull/5991))

## [[2.0.1223](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1223-user_index)] - 2024-07-04

### Changed

- Wire up user_index to use synced chit and streak ([#5979](https://github.com/open-chat-labs/open-chat/pull/5979))

## [[2.0.1221](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1221-user_index)] - 2024-07-03

### Added

- Added `c2c_notify_chit` to sync chit balance and streak from user canister ([#5972](https://github.com/open-chat-labs/open-chat/pull/5972))

### Changed

- In `ChitEarnedReason::Achievement` replaced `String` with `Achievement` ([#5962](https://github.com/open-chat-labs/open-chat/pull/5962))

## [[2.0.1200](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1200-user_index)] - 2024-06-07

### Changed

- Get volatile data for users created since timestamp ([#5921](https://github.com/open-chat-labs/open-chat/pull/5921))

## [[2.0.1199](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1199-user_index)] - 2024-06-07

### Changed

- Increase user limit from 150,000 to 200,000 ([#5916](https://github.com/open-chat-labs/open-chat/pull/5916))

## [[2.0.1196](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1196-user_index)] - 2024-06-06

### Changed

- Clear the `empty_users` list ([#5912](https://github.com/open-chat-labs/open-chat/pull/5912))
- Changed `users` args to match `users_v2` args ([#5913](https://github.com/open-chat-labs/open-chat/pull/5913))

## [[2.0.1192](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1192-user_index)] - 2024-06-04

### Added

New `users` endpoint to handle volatile user data ([#5900](https://github.com/open-chat-labs/open-chat/pull/5900))

### Changed

- Add 14 day CHIT streak ([#5902](https://github.com/open-chat-labs/open-chat/pull/5902))
- Push `user_claimed_daily_chit` event ([#5906](https://github.com/open-chat-labs/open-chat/pull/5906))

## [[2.0.1186](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1186-user_index)] - 2024-06-04

### Changed

- Job to update users whose streak ended yesterday ([#5896](https://github.com/open-chat-labs/open-chat/pull/5896))

## [[2.0.1182](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1182-user_index)] - 2024-05-23

### Added

- Allow users to delete their accounts ([#5775](https://github.com/open-chat-labs/open-chat/pull/5775))
- CHIT balance and streak per user ([#5817](https://github.com/open-chat-labs/open-chat/pull/5817))
- CHIT leaderboard ([#5820](https://github.com/open-chat-labs/open-chat/pull/5820))
- Reward meme contest winners with CHIT ([#5842](https://github.com/open-chat-labs/open-chat/pull/5842))

### Changed

- CHIT leaderboard fixed + returns username ([#5837](https://github.com/open-chat-labs/open-chat/pull/5837))

### Removed

- Remove code to migrate identities to Identity canister ([#5808](https://github.com/open-chat-labs/open-chat/pull/5808))

## [[2.0.1164](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1164-user_index)] - 2024-05-03

### Changed

- Handle case where users have duplicate principals ([#5765](https://github.com/open-chat-labs/open-chat/pull/5765))
- Log user Ids whenever there is a principal clash ([#5766](https://github.com/open-chat-labs/open-chat/pull/5766))

## [[2.0.1163](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1163-user_index)] - 2024-05-02

### Fixed

- Retry principal migrations which failed ([#5758](https://github.com/open-chat-labs/open-chat/pull/5758))

## [[2.0.1160](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1160-user_index)] - 2024-05-01

### Changed

- Make backup of UserId -> Principal map ([#5727](https://github.com/open-chat-labs/open-chat/pull/5727))
- Don't retry c2c calls after getting a `DestinationInvalid` error ([#5732](https://github.com/open-chat-labs/open-chat/pull/5732))
- Don't retry c2c calls after getting a `CanisterMethodNotFound` error ([#5747](https://github.com/open-chat-labs/open-chat/pull/5747))
- Top up user canister with cycles if required during principal update ([#5753](https://github.com/open-chat-labs/open-chat/pull/5753))

## [[2.0.1156](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1156-user_index)] - 2024-04-26

### Changed

- Mark principals as migrated after being updated ([#5726](https://github.com/open-chat-labs/open-chat/pull/5726))

## [[2.0.1146](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1146-user_index)] - 2024-04-23

### Added

- Mark which user accounts are more than 6 month old and have no chats ([#5696](https://github.com/open-chat-labs/open-chat/pull/5696))

### Changed

- Add `principal_updates` to `current_user` response ([#5657](https://github.com/open-chat-labs/open-chat/pull/5657))
- Add `block_level_markdown` flag to messages ([#5680](https://github.com/open-chat-labs/open-chat/pull/5680))
- Cater for old bug which caused a few users to have duplicate principals ([#5694](https://github.com/open-chat-labs/open-chat/pull/5694))
- Update `event_store` packages to v0.1.0 ([#5715](https://github.com/open-chat-labs/open-chat/pull/5715))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

## [[2.0.1134](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1134-user_index)] - 2024-04-09

### Changed

- Log error if any users have duplicate usernames or principals ([#5645](https://github.com/open-chat-labs/open-chat/pull/5645))
- Re-sync principals to Identity canister but excluding bot users ([#5650](https://github.com/open-chat-labs/open-chat/pull/5650))

### Fixed

- Fix job to sync principals to Identity canister ([#5649](https://github.com/open-chat-labs/open-chat/pull/5649))

## [[2.0.1129](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1129-user_index)] - 2024-04-05

### Added

- Sync legacy principals to the Identity canister ([#5619](https://github.com/open-chat-labs/open-chat/pull/5619))

### Changed

- Update `event_store` packages to latest version ([#5593](https://github.com/open-chat-labs/open-chat/pull/5593))
- Add `date_created` to `current_user` response ([#5635](https://github.com/open-chat-labs/open-chat/pull/5635))

## [[2.0.1111](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1111-user_index)] - 2024-03-20

### Changed

- Avoid case where principal migration could happen twice ([#5528](https://github.com/open-chat-labs/open-chat/pull/5528))
- Update `event_store` packages to latest version ([#5535](https://github.com/open-chat-labs/open-chat/pull/5535))
- Pause principal migration job if pending queue becomes too large ([#5557](https://github.com/open-chat-labs/open-chat/pull/5557))
- Update `event_store` packages to latest version ([#5568](https://github.com/open-chat-labs/open-chat/pull/5568))

### Fixed

- Fix 'out of cycles' check to use new response code ([#5503](https://github.com/open-chat-labs/open-chat/pull/5503))
- Fix upgrading from previous events format ([#5579](https://github.com/open-chat-labs/open-chat/pull/5579))

## [[2.0.1091](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1091-user_index)] - 2024-03-07

### Changed

- Support populating usernames in OpenChat Bot messages ([#5476](https://github.com/open-chat-labs/open-chat/pull/5476))

## [[2.0.1083](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1083-user_index)] - 2024-02-29

### Changed

- Update `EventSinkClient` to latest version ([#5431](https://github.com/open-chat-labs/open-chat/pull/5431))
- Add `event_relay_canister_id` to LocalUserIndex init args ([#5436](https://github.com/open-chat-labs/open-chat/pull/5436))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Put back code to sync secret key with LocalUserIndexes ([#5455](https://github.com/open-chat-labs/open-chat/pull/5455))

## [[2.0.1071](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1071-user_index)] - 2024-02-22

### Added

- Add `public_key` query endpoint ([#5414](https://github.com/open-chat-labs/open-chat/pull/5414))

### Changed

- Propagate video call operators ids for guarding ([#5374](https://github.com/open-chat-labs/open-chat/pull/5374))
- Generate and store an OpenChat public/private key pair ([#5383](https://github.com/open-chat-labs/open-chat/pull/5383))
- Sync secret key with local_user_indexes ([#5398](https://github.com/open-chat-labs/open-chat/pull/5398))
- Add `is_from_identity_canister` to `UserRegistered` events ([#5402](https://github.com/open-chat-labs/open-chat/pull/5402))

## [[2.0.1061](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1061-user_index)] - 2024-02-14

### Added

- Push backdated `diamond_membership_payment` events ([#5372](https://github.com/open-chat-labs/open-chat/pull/5372))

### Changed

- Revert job start / stop messages back to `trace` level ([#5370](https://github.com/open-chat-labs/open-chat/pull/5370))

### Fixed

- Use `set_timer` rather than `set_timer_interval` ([#5369](https://github.com/open-chat-labs/open-chat/pull/5369))

## [[2.0.1059](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1059-user_index)] - 2024-02-13

### Fixed

- Push all `user_registered` events again now that they are being anonymised ([#5366](https://github.com/open-chat-labs/open-chat/pull/5366))

## [[2.0.1056](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1056-user_index)] - 2024-02-13

### Added

- Push backdated `user_registered` events for existing users ([#5345](https://github.com/open-chat-labs/open-chat/pull/5345))

### Changed

- Log `info` level message rather than `trace` when jobs start / stop ([#5348](https://github.com/open-chat-labs/open-chat/pull/5348))
- Add more details of background jobs to metrics ([#5349](https://github.com/open-chat-labs/open-chat/pull/5349))

### Fixed

- Don't invoke `ic0::call_new()` while in init mode ([#5358](https://github.com/open-chat-labs/open-chat/pull/5358))

## [[2.0.1054](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1054-user_index)] - 2024-02-09

### Added

- Track `user_registered` and `diamond_membership_payment` events ([#5342](https://github.com/open-chat-labs/open-chat/pull/5342))
- Expose `EventSinkClientInfo` in metrics ([#5344](https://github.com/open-chat-labs/open-chat/pull/5344))

## [[2.0.1047](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1047-user_index)] - 2024-02-05

### Added

- Add `c2c_send_openchat_bot_messages` endpoint ([#5319](https://github.com/open-chat-labs/open-chat/pull/5319))

### Changed

- Push `DiamondMembershipPaymentReceived` events to all LocalUserIndexes ([#5322](https://github.com/open-chat-labs/open-chat/pull/5322))

## [[2.0.1040](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1040-user_index)] - 2024-02-02

### Added

- Transfer balance from old Diamond membership payments to treasury ([#5307](https://github.com/open-chat-labs/open-chat/pull/5307))

### Changed

- Remove excess 0's from token amount in referral reward messages ([#5308](https://github.com/open-chat-labs/open-chat/pull/5308))

## [[2.0.1039](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1039-user_index)] - 2024-02-01

### Changed

- Reduce size of user data when serialized ([#5289](https://github.com/open-chat-labs/open-chat/pull/5289))
- Log the users whose Diamond membership payments failed ([#5305](https://github.com/open-chat-labs/open-chat/pull/5305))

### Fixed

- Unblock payments for users whose previous Diamond payments failed ([#5295](https://github.com/open-chat-labs/open-chat/pull/5295))

## [[2.0.1024](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1024-user_index)] - 2024-01-25

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))
- Sync user principals to the Identity canister ([#5264](https://github.com/open-chat-labs/open-chat/pull/5264))

### Changed

- Rename `service_principals` to `governance_principals` in init args ([#5251](https://github.com/open-chat-labs/open-chat/pull/5251))
- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))

### Fixed

- Fix message reporting ([#5258](https://github.com/open-chat-labs/open-chat/pull/5258))

## [[2.0.1018](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1018-user_index)] - 2024-01-24

### Changed

- Simplify timer jobs + make them more efficient ([#5233](https://github.com/open-chat-labs/open-chat/pull/5233))
- Avoid setting up canister timer unless job already in progress ([#5243](https://github.com/open-chat-labs/open-chat/pull/5243))

### Removed

- Remove `DiamondMembershipExpiryDate` event which is no longer needed ([#5245](https://github.com/open-chat-labs/open-chat/pull/5245))

### Fixed

- Notify community canisters when a user is unsuspended ([#5227](https://github.com/open-chat-labs/open-chat/pull/5227))
- Unsuspend user who was only partially unsuspended due to bug ([#5247](https://github.com/open-chat-labs/open-chat/pull/5247))
- Unsuspend more users who were also affected ([#5248](https://github.com/open-chat-labs/open-chat/pull/5248))

## [[2.0.1007](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1007-user_index)] - 2024-01-16

### Added

- Add endpoint for viewing moderation reports ([#5188](https://github.com/open-chat-labs/open-chat/pull/5188))

### Changed

- Add `is_platform_operator` to `current_user` response ([#5161](https://github.com/open-chat-labs/open-chat/pull/5161))

## [[2.0.1000](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1000-user_index)] - 2024-01-05

### Added

- Add endpoint for platform_ops to set diamond fees ([#5108](https://github.com/open-chat-labs/open-chat/pull/5108))

### Changed

- Better formatting of proposal payloads ([#5115](https://github.com/open-chat-labs/open-chat/pull/5115))

## [[2.0.977](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.977-user_index)] - 2023-12-19

### Changed

- Some adjustments to modclub submissions ([#5000](https://github.com/open-chat-labs/open-chat/pull/5000))
- Add `escrow_canister_id` to LocalUserIndex canister init args ([#4897](https://github.com/open-chat-labs/open-chat/pull/4897))
- Store Diamond membership expiry dates in LocalUserIndex canisters ([#5025](https://github.com/open-chat-labs/open-chat/pull/5025))
- Make Diamond membership gate check synchronous ([#5027](https://github.com/open-chat-labs/open-chat/pull/5027))
- Reduce Diamond membership fees due to ICP price increase ([#5032](https://github.com/open-chat-labs/open-chat/pull/5032))

### Fixed

- Fix incorrect `local_user_index_canister_id` values ([#5009](https://github.com/open-chat-labs/open-chat/pull/5009))

## [[2.0.969](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.969-user_index)] - 2023-12-12

### Changed

- Pay rewards based on one year if referred user becomes lifetime member ([#4979](https://github.com/open-chat-labs/open-chat/pull/4979))

### Removed

- Remove code needed to initialise `local_user_index_canister_id` values ([#4981](https://github.com/open-chat-labs/open-chat/pull/4981))

## [[2.0.964](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.964-user_index)] - 2023-12-06

### Added

- Expose number of lifetime Diamond members in metrics ([#4929](https://github.com/open-chat-labs/open-chat/pull/4929))
- Optionally return suspended users from `users_v2` ([#4945](https://github.com/open-chat-labs/open-chat/pull/4945))

## [[2.0.955](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.955-user_index)] - 2023-12-05

### Added

- Expose count of new users per day ([#4873](https://github.com/open-chat-labs/open-chat/pull/4873))
- Introduce `Lifetime Diamond Membership` ([#4876](https://github.com/open-chat-labs/open-chat/pull/4876))
- Support updating Diamond membership subscription ([#4884](https://github.com/open-chat-labs/open-chat/pull/4884))
- Add `diamond_membership_status` to `current_user` response ([#4896](https://github.com/open-chat-labs/open-chat/pull/4896))
- Expose list of registered bot users ([#4919](https://github.com/open-chat-labs/open-chat/pull/4919))

### Changed

- Top up NNS neuron when users pay ICP for lifetime Diamond membership ([#4880](https://github.com/open-chat-labs/open-chat/pull/4880))
- Add `diamond_membership_status` to user summaries ([#4887](https://github.com/open-chat-labs/open-chat/pull/4887))
- Allow extending Diamond membership even if > 3 month remaining ([#4909](https://github.com/open-chat-labs/open-chat/pull/4909))
- Require Diamond membership to set a display name ([#4910](https://github.com/open-chat-labs/open-chat/pull/4910))

## [[2.0.952](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.952-user_index)] - 2023-11-28

### Changed

- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Enable rule violation suspensions ([#4846](https://github.com/open-chat-labs/open-chat/pull/4846))
- In modclub reports only show public message links ([#4847](https://github.com/open-chat-labs/open-chat/pull/4847))
- Add `local_user_index_canister_id` to group/community summaries ([#4857](https://github.com/open-chat-labs/open-chat/pull/4857))

### Removed

- Remove code to initialize the ModClub integration ([#4826](https://github.com/open-chat-labs/open-chat/pull/4826))

## [[2.0.934](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.934-user_index)] - 2023-11-15

### Added

- Support paying in CHAT for Diamond membership ([#4748](https://github.com/open-chat-labs/open-chat/pull/4748))
- Return Diamond membership fees from UserIndex ([#4751](https://github.com/open-chat-labs/open-chat/pull/4751))
- Implement modclub integration for reporting ([#4726](https://github.com/open-chat-labs/open-chat/pull/4726))

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))

### Fixed

- Fix text formatting in OpenChat Bot message ([#4706](https://github.com/open-chat-labs/open-chat/pull/4706))

## [[2.0.905](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.905-user_index)] - 2023-10-27

### Added

- Add `permissions_v2` to group/channel summary ([#4620](https://github.com/open-chat-labs/open-chat/pull/4620))

## [[2.0.893](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.893-user_index)] - 2023-10-19

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

## [[2.0.877](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.877-user_index)] - 2023-10-09

### Changed

- Add `username` to `c2c_lookup_user` response ([#4511](https://github.com/open-chat-labs/open-chat/pull/4511))
- Simplify jobs to sync data to LocalUserIndexes + StorageIndex ([#4517](https://github.com/open-chat-labs/open-chat/pull/4517))

## [[2.0.873](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.873-user_index)] - 2023-10-06

### Changed

- Store `proposals_bot_canister_id` in user canisters ([#4485](https://github.com/open-chat-labs/open-chat/pull/4485))

## [[2.0.861](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.861-user_index)] - 2023-09-26

### Changed

- Allow bots to register with display names ([#4377](https://github.com/open-chat-labs/open-chat/pull/4377))
- Allow querying users without being a known user principal ([#4426](https://github.com/open-chat-labs/open-chat/pull/4426))

## [[2.0.840](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.840-user_index)] - 2023-09-06

### Changed

- Allow user to change the case of their username ([#4302](https://github.com/open-chat-labs/open-chat/pull/4302))

## [[2.0.833](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.833-user_index)] - 2023-09-02

### Changed

- Validate `display_name` + match on `display_name` for user search ([#4282](https://github.com/open-chat-labs/open-chat/pull/4282))

## [[2.0.829](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.829-user_index)] - 2023-09-01

### Added

- Add optional user `display name` ([#4247](https://github.com/open-chat-labs/open-chat/pull/4247))
- Validate `display_name` + search ([#4282](https://github.com/open-chat-labs/open-chat/pull/4282))

### Changed

- Consolidate and simplify user/group/community name validation ([#4265](https://github.com/open-chat-labs/open-chat/pull/4265))

## [[2.0.820](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.820-user_index)] - 2023-08-24

### Changed

- Include `use_for_new_canisters` when displaying upgrade proposals ([#4214](https://github.com/open-chat-labs/open-chat/pull/4214))
- Improve upgrade version check to support multiple active versions ([#4215](https://github.com/open-chat-labs/open-chat/pull/4215))
- Extend versioned rules to communities and groups ([#4219](https://github.com/open-chat-labs/open-chat/pull/4219))

## [[2.0.792](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.792-user_index)] - 2023-08-08

### Changed

- Validate text length based on number of chars rather than bytes ([#4154](https://github.com/open-chat-labs/open-chat/pull/4154))
- Bump number of cycles required for upgrade ([#4155](https://github.com/open-chat-labs/open-chat/pull/4155))

## [[2.0.783](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.783-user_index)] - 2023-08-02

### Changed

- Add an `UNDER_REVIEW` moderation flag ([#4104](https://github.com/open-chat-labs/open-chat/pull/4104))

### Fixed

- Handle `set_moderation_flags` in `inspect_message` ([#4058](https://github.com/open-chat-labs/open-chat/pull/4058))

## [[2.0.759](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.759-user_index)] - 2023-07-28

### Changed

- Mark channels as read after joining community or channel ([#4004](https://github.com/open-chat-labs/open-chat/pull/4004))
- Store `moderation_flags_enabled` on each user's profile ([#4050](https://github.com/open-chat-labs/open-chat/pull/4050))

## [[2.0.758](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.758-user_index)] - 2023-07-20

### Changed

- Set up name change from 'SuperAdmin' to 'PlatformModerator' ([#3863](https://github.com/open-chat-labs/open-chat/pull/3863))
- Remove dependency on `ic-sns-governance` ([#3965](https://github.com/open-chat-labs/open-chat/pull/3965))
- Stop using `transaction_hash` field on SNS transactions ([#3967](https://github.com/open-chat-labs/open-chat/pull/3967))
- Remove dependencies on IC repo ([#3970](https://github.com/open-chat-labs/open-chat/pull/3970))

## [[2.0.733](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.733-user_index)] - 2023-06-27

### Added

- Add `expiry` to referral codes ([#3705](https://github.com/open-chat-labs/open-chat/pull/3705))

### Changed

- Add random Memo to `PendingPayment` to ensure no duplicates ([#3824](https://github.com/open-chat-labs/open-chat/pull/3824))

## [[2.0.709](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.709-user_index)] - 2023-06-01

### Added

- Add `is_platform_moderator` to `current_user` response ([#3640](https://github.com/open-chat-labs/open-chat/pull/3640))

## [[2.0.699](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.699-user_index)] - 2023-05-18

### Added

- Added `JoinUserToGroup` event ([#3613](https://github.com/open-chat-labs/open-chat/pull/3613))

### Changed

- Only retry transfers where the c2c call failed ([#3614](https://github.com/open-chat-labs/open-chat/pull/3614))

### Removed

- Remove `register_user_v2` since users now register via a LocalUserIndex ([#3583](https://github.com/open-chat-labs/open-chat/pull/3583))

## [[2.0.684](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.684-user_index)] - 2023-05-10

### Fixed

- Fix incorrect calculation in backdated referral rewards ([#3562](https://github.com/open-chat-labs/open-chat/pull/3562))

## [[2.0.683](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.683-user_index)] - 2023-05-10

### Changed

- Restart payments job if final payment in queue fails ([#3551](https://github.com/open-chat-labs/open-chat/pull/3551))
- Append a suffix when registering if username is taken ([#3553](https://github.com/open-chat-labs/open-chat/pull/3553))
- Register users via LocalUserIndex to improve speed ([#3557](https://github.com/open-chat-labs/open-chat/pull/3557))

### Fixed

- Fix the 'Top Referrers' leaderboard which has double counted referrals ([#3549](https://github.com/open-chat-labs/open-chat/pull/3549))

## [[2.0.679](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.679-user_index)] - 2023-05-08

### Changed

- Bitcoin Miami welcome messages ([#3532](https://github.com/open-chat-labs/open-chat/pull/3532))

### Fixed

- Fix group invite messages ([#3543](https://github.com/open-chat-labs/open-chat/pull/3543))

## [[2.0.673](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.673-user_index)] - 2023-04-28

### Changed

- Pass OpenChat bot messages in user canister init args ([#3517](https://github.com/open-chat-labs/open-chat/pull/3517))

## [[2.0.671](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.671-user_index)] - 2023-04-28

### Added

- Expose user referral leaderboards ([#3482](https://github.com/open-chat-labs/open-chat/pull/3482))
- Add `add_referral_codes` and `register_user_v2` endpoints to support BTC Miami ([#3485](https://github.com/open-chat-labs/open-chat/pull/3485))
- Add each new platform moderator to a moderation group ([#3493](https://github.com/open-chat-labs/open-chat/pull/3493))
- Added `platform_moderators_group` query endpoint ([#3495](https://github.com/open-chat-labs/open-chat/pull/3495))
- Join users who register with relevant code to Bitcoin Miami group ([#3501](https://github.com/open-chat-labs/open-chat/pull/3501))

### Changed

- Reduce a few timer job intervals ([#3515](https://github.com/open-chat-labs/open-chat/pull/3515))

## [[2.0.668](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.668-user_index)] - 2023-04-19

### Changed

- Share Diamond membership payment with referrer ([#3452](https://github.com/open-chat-labs/open-chat/pull/3452))
- Send OpenChatBot welcome messages from the UserIndex ([#3478](https://github.com/open-chat-labs/open-chat/pull/3478))

### Removed

- Remove one-time code to sync `diamond_membership_expires_at` with user canisters ([#3467](https://github.com/open-chat-labs/open-chat/pull/3467))

## [[2.0.666](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.666-user_index)] - 2023-04-17

### Changed

- Store `diamond_membership_expires_at` in each user canister ([#3428](https://github.com/open-chat-labs/open-chat/pull/3428))

### Removed

- Remove code to handle the initial airdrop ([#3462](https://github.com/open-chat-labs/open-chat/pull/3462))

### Fixed

- Fix `referral_metrics` endpoint ([#3461](https://github.com/open-chat-labs/open-chat/pull/3461))

## [[2.0.661](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.661-user_index)] - 2023-04-15

### Added

- Added `referral_metrics` endpoint ([#3429](https://github.com/open-chat-labs/open-chat/pull/3429))

### Removed

- Removed `c2c_lookup_principal` ([#3414](https://github.com/open-chat-labs/open-chat/pull/3414))
- Remove CAPTCHA and instead verify public key is derived from II canister ([#3426](https://github.com/open-chat-labs/open-chat/pull/3426))

### Fixed

- Ensure only one airdrop neuron is created at a time ([#3458](https://github.com/open-chat-labs/open-chat/pull/3458))

## [[2.0.656](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.656-user_index)] - 2023-04-05

### Added

- Implement job to distribute initial airdrop neurons ([#3398](https://github.com/open-chat-labs/open-chat/pull/3398))
- Added `is_diamond_member` to `c2c_lookup_user` ([#3408](https://github.com/open-chat-labs/open-chat/pull/3408))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-chat-labs/open-chat/pull/3375))

## [[2.0.649](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.649-user_index)] - 2023-03-25

### Fixed

- Fix bug when joining group on a different subnet ([#3373](https://github.com/open-chat-labs/open-chat/pull/3373))

## [[2.0.643](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.643-user_index)] - 2023-03-24

### Changed

- Speed up `is_eligible_for_initial_airdrop` check ([#3345](https://github.com/open-chat-labs/open-chat/pull/3345))

### Removed

- Removed super_admin role from groups([#3319](https://github.com/open-chat-labs/open-chat/pull/3319))

## [[2.0.636](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.636-user_index)] - 2023-03-14

### Added

- APIs to add/remove/list platform operators ([#3264](https://github.com/open-chat-labs/open-chat/pull/3264))
- Endpoint for platform ops to set user upgrade concurrency ([#3268](https://github.com/open-chat-labs/open-chat/pull/3268))
- Implemented recurring Diamond membership payments ([#3274](https://github.com/open-chat-labs/open-chat/pull/3274))
- Expose more metrics about Diamond membership payments ([#3276](https://github.com/open-chat-labs/open-chat/pull/3276))
- Added `caller_is_openchat_user` guard to a few endpoints ([#3279](https://github.com/open-chat-labs/open-chat/pull/3279))
- Added endpoints to collect neuron controllers for the initial airdrop ([#3287](https://github.com/open-chat-labs/open-chat/pull/3287))

### Changed

- Use `canister_timer_jobs` package to simplify timer jobs ([#3263](https://github.com/open-chat-labs/open-chat/pull/3263))
- Increased user limit to 150,000 ([#3267](https://github.com/open-chat-labs/open-chat/pull/3267))

### Removed

- Removed code only needed for previous upgrade ([#3262](https://github.com/open-chat-labs/open-chat/pull/3262))
- Removed `set_governance_principals` ([#3301](https://github.com/open-chat-labs/open-chat/pull/3301))

### Fixed

- Ensure job to sync events to local user indexes always runs ([#3295](https://github.com/open-chat-labs/open-chat/pull/3295))

## [[2.0.623](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.623-user_index)] - 2023-03-02

### Changed

- Renamed super_admin endpoints to platform_moderator ([#3249](https://github.com/open-chat-labs/open-chat/pull/3249))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248)) & ([#3251](https://github.com/open-chat-labs/open-chat/pull/3251))
- Revert code to register each LocalGroupIndex as a user ([#3255](https://github.com/open-chat-labs/open-chat/pull/3255))

## [[2.0.615](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.615-user_index)] - 2023-02-28

### Changed

- Consolidate code to install / upgrade canisters ([#3152](https://github.com/open-chat-labs/open-chat/pull/3152))
- Skip upgrades where new wasm version matches current version ([#3158](https://github.com/open-chat-labs/open-chat/pull/3158))
- Upgrade LocalUserIndex canisters using a timer job rather than heartbeat ([#3229](https://github.com/open-chat-labs/open-chat/pull/3229))
- Switch to using canister timers instead of heartbeat ([#3230](https://github.com/open-chat-labs/open-chat/pull/3230))

### Removed

- Remove one time code to set up `GroupUpgradeBot` users ([#3159](https://github.com/open-chat-labs/open-chat/pull/3159))

## [[2.0.594](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.594-user_index)] - 2023-02-16

### Added

- Support upgrading a filtered set of canisters ([#3145](https://github.com/open-chat-labs/open-chat/pull/3145))

### Changed

- Registered each LocalGroupIndex as a bot user ([#3128](https://github.com/open-chat-labs/open-chat/pull/3128))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-chat-labs/open-chat/pull/3133))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-chat-labs/open-chat/pull/3143))

## [[2.0.590](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.590-user_index)] - 2023-02-10

### Added

- Diamond metrics ([#3117](https://github.com/open-chat-labs/open-chat/pull/3117))

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))

### Removed

- Removed code for upgrading storage and confirming phone number ([#3110](https://github.com/open-chat-labs/open-chat/pull/3110))
- Removed one time code to sync users to OpenStorage ([#3114](https://github.com/open-chat-labs/open-chat/pull/3114))

## [[2.0.584](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.584-user_index)] - 2023-02-09

### Changed

- Push all users to OpenStorage with the new storage limits ([#3104](https://github.com/open-chat-labs/open-chat/pull/3104))

### Removed

- Removed code only needed for the previous upgrade ([#3102](https://github.com/open-chat-labs/open-chat/pull/3102))

## [[2.0.580](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.580-user_index)] - 2023-02-09

### Added

- Added `pay_for_diamond_membership` ([#3069](https://github.com/open-chat-labs/open-chat/pull/3069))

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-chat-labs/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Remove captcha challenge after any attempt ([#3078](https://github.com/open-chat-labs/open-chat/pull/3078))
- Mark user as updated after taking Diamond membership payment ([#3081](https://github.com/open-chat-labs/open-chat/pull/3081))
- Give all verified users 12 months Diamond membership ([#3082](https://github.com/open-chat-labs/open-chat/pull/3082))

### Fixed

- Fix c2c_register_bot so it queues UserRegistered ([#3086](https://github.com/open-chat-labs/open-chat/pull/3086))
- Fix username uniqueness check to include reserved usernames ([#3088](https://github.com/open-chat-labs/open-chat/pull/3088))

## [[2.0.570](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.570-user_index)] - 2023-02-01

### Added

- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-chat-labs/open-chat/pull/3038))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))

## [[2.0.558](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.558-user_index)] - 2023-01-23

### Added

- Expose validation methods for functions that will be called via proposals ([#2990](https://github.com/open-chat-labs/open-chat/pull/2990))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))

## [[2.0.544](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.544-user_index)] - 2023-01-08

### Added

- Added `c2c_notify_events` for receiving events from local user indexes ([#2955](https://github.com/open-chat-labs/open-chat/pull/2955))

### Fixed

- Free up username if registration fails ([#2952](https://github.com/open-chat-labs/open-chat/pull/2952))
