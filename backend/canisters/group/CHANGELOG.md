# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Fixed

- Fix messageId deduplication for groups which used disappearing messages ([#7503](https://github.com/open-chat-labs/open-chat/pull/7503))

## [[2.0.1619](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1619-group)] - 2025-02-28

### Added

- Add api_key query endpoint callable by owner(s) ([#7431](https://github.com/open-chat-labs/open-chat/pull/7431))
- Support `sync_api_key` cmd + min required cmd role ([#7439](https://github.com/open-chat-labs/open-chat/pull/7439))
- Introduce `IdempotencyChecker` in preparation for using best-effort calls ([#7457](https://github.com/open-chat-labs/open-chat/pull/7457))
- Introduce new idempotent endpoints for C2C calls ([#7492](https://github.com/open-chat-labs/open-chat/pull/7492))
- Add `c2c_bot_group_details` ([#7499](https://github.com/open-chat-labs/open-chat/pull/7499))

### Changed

- Serialize notifications using MessagePack rather than Candid ([#7445](https://github.com/open-chat-labs/open-chat/pull/7445))
- Reduce the size of notifications when serialized ([#7448](https://github.com/open-chat-labs/open-chat/pull/7448))
- Move new message validation to `MessageContentInternal` ([#7452](https://github.com/open-chat-labs/open-chat/pull/7452))
- Encode permissions within bot API keys as bitflags ([#7456](https://github.com/open-chat-labs/open-chat/pull/7456))
- Group summaries updated when api keys generated ([#7478](https://github.com/open-chat-labs/open-chat/pull/7478))

### Removed

- Remove the old `start_video_call` and `end_video_call` endpoints ([#7399](https://github.com/open-chat-labs/open-chat/pull/7399))

## [[2.0.1604](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1604-group)] - 2025-02-10

### Fixed

- Fix messageId deduplication to cater for disappearing messages ([#7369](https://github.com/open-chat-labs/open-chat/pull/7369))

## [[2.0.1602](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1602-group)] - 2025-02-06

### Changed

- Restructure to handle autonomous bots ([#7318](https://github.com/open-chat-labs/open-chat/pull/7318))
- Add `sender` to notifications to support blocking notifications from blocked users ([#7330](https://github.com/open-chat-labs/open-chat/pull/7330))
- Expose each bot action as a separate endpoint ([#7345](https://github.com/open-chat-labs/open-chat/pull/7345))
- Send OC's share of access gate joining fees to the treasury canister ([#7353](https://github.com/open-chat-labs/open-chat/pull/7353))
- Ensure message Ids have successfully been deduped ([#7355](https://github.com/open-chat-labs/open-chat/pull/7355))
- Avoid storing achievements for users who leave the group ([#7356](https://github.com/open-chat-labs/open-chat/pull/7356))

### Fixed

- Avoid retrying c2c call if recipient canister is uninstalled ([#7302](https://github.com/open-chat-labs/open-chat/pull/7302))
- Fix `c2c_can_issue_access_token` ([#7366](https://github.com/open-chat-labs/open-chat/pull/7366))

## [[2.0.1581](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1581-group)] - 2025-01-24

### Added

- Add facility to set/revoke group verification via proposal ([#7240](https://github.com/open-chat-labs/open-chat/pull/7240))

### Changed

- Reduce message Ids to 64 bits down from 128 bits ([#7232](https://github.com/open-chat-labs/open-chat/pull/7232))
- Reduce channel Ids to 32 bits down from 128 bits ([#7233](https://github.com/open-chat-labs/open-chat/pull/7233))
- Add `start_video_call_v2` and `end_video_call_v2` with reduced arg sizes ([#7236](https://github.com/open-chat-labs/open-chat/pull/7236))
- Disallow forwarding prize messages and governance proposal messages ([#7260](https://github.com/open-chat-labs/open-chat/pull/7260))
- Move storage of group bots up a level ([#7265](https://github.com/open-chat-labs/open-chat/pull/7265))
- Sync bot installation with UserIndex ([#7291](https://github.com/open-chat-labs/open-chat/pull/7291))
- Introduce new `Integer` bot parameter type ([#7296](https://github.com/open-chat-labs/open-chat/pull/7296))

### Fixed

- De-duplicate messageIds using a timer job ([#7275](https://github.com/open-chat-labs/open-chat/pull/7275))
- Fix message size limit being exceeded when importing group into community ([#7278](https://github.com/open-chat-labs/open-chat/pull/7278))

## [[2.0.1569](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1569-group)] - 2025-01-14

### Changed

- Log error if end video call job fails ([#7066](https://github.com/open-chat-labs/open-chat/pull/7066))
- 2-stage bot messages + bot context in messages ([#7060](https://github.com/open-chat-labs/open-chat/pull/7060))
- Log error if tip fails due to recipient mismatch ([#7151](https://github.com/open-chat-labs/open-chat/pull/7151))
- Introduce `StableMemoryMap` trait to simplify storing in stable memory ([#7176](https://github.com/open-chat-labs/open-chat/pull/7176))
- When disappearing messages expire delete any linked files ([#7184](https://github.com/open-chat-labs/open-chat/pull/7184))
- Use typed command in `BotCommandClaims` ([#7113](https://github.com/open-chat-labs/open-chat/pull/7113))
- Use macro to create grouped timer job types ([#7224](https://github.com/open-chat-labs/open-chat/pull/7224))

### Removed

- Remove bot thread permissions ([#7071](https://github.com/open-chat-labs/open-chat/pull/7071))
- Remove NewJoinerRewards which are no longer used ([#7074](https://github.com/open-chat-labs/open-chat/pull/7074))

### Fixed

- Fix any long-running video calls that failed to be marked as ended ([#7068](https://github.com/open-chat-labs/open-chat/pull/7068))
- Avoid case where prize claims could result in "duplicate transfer" error ([#7079](https://github.com/open-chat-labs/open-chat/pull/7079))
- Avoid exporting the final `ChatFrozen` event when importing a group ([#7206](https://github.com/open-chat-labs/open-chat/pull/7206))

## [[2.0.1516](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1516-group)] - 2024-12-13

### Added

- Update group bot config ([#7018](https://github.com/open-chat-labs/open-chat/pull/7018))

### Changed

- Return bots in community/group selected updates ([#7009](https://github.com/open-chat-labs/open-chat/pull/7009))
- Include the ledger canister Id in transfer failed error logs ([#7011](https://github.com/open-chat-labs/open-chat/pull/7011))
- Ensure bot has permission to execute given action ([#7014](https://github.com/open-chat-labs/open-chat/pull/7014))
- Allow bots to send a subset of message types ([#7016](https://github.com/open-chat-labs/open-chat/pull/7016))
- Switch to using `PrincipalToStableMemoryMap` ([#7023](https://github.com/open-chat-labs/open-chat/pull/7023))
- Implement new lightweight search index for searching messages ([#7029](https://github.com/open-chat-labs/open-chat/pull/7029))
- Make `MessageId` comparisons use their 64bit representation ([#7030](https://github.com/open-chat-labs/open-chat/pull/7030))
- Record user who added bot to community/group ([#7035](https://github.com/open-chat-labs/open-chat/pull/7035))
- Bot message visibility tied to initiating user ([#7044](https://github.com/open-chat-labs/open-chat/pull/7044))

## [[2.0.1501](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1501-group)] - 2024-12-06

### Added

- Add/remove bot to/from group ([#6998](https://github.com/open-chat-labs/open-chat/pull/6998))

### Changed

- Remove chat members from being stored on the heap ([#6942](https://github.com/open-chat-labs/open-chat/pull/6942))
- Check bot + user permissions when issuing JWT ([#6970](https://github.com/open-chat-labs/open-chat/pull/6970))
- Reduce size of search index when serialized ([#6973](https://github.com/open-chat-labs/open-chat/pull/6973))
- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))
- Reduce size of the `UserCache` ([#6982](https://github.com/open-chat-labs/open-chat/pull/6982))

## [[2.0.1494](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1494-group)] - 2024-12-04

### Changed

- Re-run member migration to stable memory using reduced size format ([#6965](https://github.com/open-chat-labs/open-chat/pull/6965))

## [[2.0.1491](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1491-group)] - 2024-12-03

### Changed

- Remove UserId from member map values since it's already in the keys ([#6945](https://github.com/open-chat-labs/open-chat/pull/6945))
- Disallow sending prize messages to threads ([#6960](https://github.com/open-chat-labs/open-chat/pull/6960))

### Removed

- Remove a load of unused candid endpoints ([#6947](https://github.com/open-chat-labs/open-chat/pull/6947))
- Remove references to bot_api_gateway ([#6944](https://github.com/open-chat-labs/open-chat/pull/6944))

### Fixed

- Don't supply a fee when BURNing ([#6948](https://github.com/open-chat-labs/open-chat/pull/6948))

## [[2.0.1487](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1487-group)] - 2024-12-02

### Changed

- Reduce size of chat members when serialized ([#6925](https://github.com/open-chat-labs/open-chat/pull/6925))
- Consolidate member verification logic into `get_verified_member` ([#6926](https://github.com/open-chat-labs/open-chat/pull/6926))
- Move members to `MembersMap` in prep for stable memory ([#6927](https://github.com/open-chat-labs/open-chat/pull/6927))
- Only handle a single bot action ([#6929](https://github.com/open-chat-labs/open-chat/pull/6929))
- Implement `MembersStableStorage` which stores members in stable memory ([#6931](https://github.com/open-chat-labs/open-chat/pull/6931))
- Migrate chat members to stable memory using timer job ([#6933](https://github.com/open-chat-labs/open-chat/pull/6933))
- Export members from stable memory when importing group into community ([#6935](https://github.com/open-chat-labs/open-chat/pull/6935))
- Make `StableMemoryMap` use strongly typed keys ([#6937](https://github.com/open-chat-labs/open-chat/pull/6937))
- Read from stable memory members map once migration is complete ([#6938](https://github.com/open-chat-labs/open-chat/pull/6938))

## [[2.0.1480](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1480-group)] - 2024-11-28

### Changed

- Simplify how we store and query proposal votes ([#6906](https://github.com/open-chat-labs/open-chat/pull/6906))
- Remove member updates after 31 days ([#6907](https://github.com/open-chat-labs/open-chat/pull/6907))
- Consolidate member updates into a single enum ([#6915](https://github.com/open-chat-labs/open-chat/pull/6915))
- Remove chat event updates after 31 days ([#6916](https://github.com/open-chat-labs/open-chat/pull/6916))

### Removed

- Remove code to migrate metrics to new reduced size format ([#6901](https://github.com/open-chat-labs/open-chat/pull/6901))
- Remove code to deduplicate @everyone mentions ([#6901](https://github.com/open-chat-labs/open-chat/pull/6901))
- Remove the old `gate` field which has been superseded by `gate_config` ([#6902](https://github.com/open-chat-labs/open-chat/pull/6902))

## [[2.0.1476](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1476-group)] - 2024-11-26

### Added

- Add new prize message criteria ([#6831](https://github.com/open-chat-labs/open-chat/pull/6831))
- Accept calls from the BotApiGateway ([#6846](https://github.com/open-chat-labs/open-chat/pull/6846))

### Changed

- Add cycles balance check to more timer jobs ([#6822](https://github.com/open-chat-labs/open-chat/pull/6822))
- Add the `BotCommand` access token type ([#6830](https://github.com/open-chat-labs/open-chat/pull/6830))
- Improve job to delete files after messages are deleted ([#6839](https://github.com/open-chat-labs/open-chat/pull/6839))
- Add `bot_api_gateway` canisterId to the canister state ([#6842](https://github.com/open-chat-labs/open-chat/pull/6842))
- Simplify `inspect_message` ([#6847](https://github.com/open-chat-labs/open-chat/pull/6847))
- Avoid cases where we were iterating over the full chat members map ([#6853](https://github.com/open-chat-labs/open-chat/pull/6853))
- Take a fee for prize messages and send to treasury ([#6854](https://github.com/open-chat-labs/open-chat/pull/6854))
- Store @everyone mentions once rather than linking to each user ([#6856](https://github.com/open-chat-labs/open-chat/pull/6856))
- Deduplicate existing @everyone mentions ([#6857](https://github.com/open-chat-labs/open-chat/pull/6857))
- Disallow promoting bots to owners ([#6865](https://github.com/open-chat-labs/open-chat/pull/6865))
- Reduce the number of events stored on the heap in the `HybridMap` ([#6867](https://github.com/open-chat-labs/open-chat/pull/6867))
- Return `FailedToDeserialize` and log error if unable to read event ([#6873](https://github.com/open-chat-labs/open-chat/pull/6873))
- Extract stable memory map so it can store additional datasets ([#6876](https://github.com/open-chat-labs/open-chat/pull/6876))
- Avoid iterating all users when determining who to notify of new message ([#6877](https://github.com/open-chat-labs/open-chat/pull/6877))
- Make `ChannelId` comparisons use their 32bit representation ([#6885](https://github.com/open-chat-labs/open-chat/pull/6885))

### Removed

- Remove code to migrate events to stable memory ([#6837](https://github.com/open-chat-labs/open-chat/pull/6837))
- Remove code to migrate to the new thread summary format ([#6862](https://github.com/open-chat-labs/open-chat/pull/6862))
- Remove any spurious video calls in progress ([#6872](https://github.com/open-chat-labs/open-chat/pull/6872))

### Fixed

- Fix a few upgrades that failed due to overflowing `u32::MAX` ([#6826](https://github.com/open-chat-labs/open-chat/pull/6826))

## [[2.0.1453](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1453-group)] - 2024-11-14

### Changed

- Store events in `HybridMap` which caches latest events on the heap ([#6762](https://github.com/open-chat-labs/open-chat/pull/6762))
- Reduce size of metrics in memory ([#6765](https://github.com/open-chat-labs/open-chat/pull/6765))
- Run cycles check (+ other background tasks) when executing timer jobs ([#6815](https://github.com/open-chat-labs/open-chat/pull/6815))

### Removed

- Remove events from being stored on the heap ([#6758](https://github.com/open-chat-labs/open-chat/pull/6758))

## [[2.0.1434](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1434-group)] - 2024-11-07

### Changed

- Consolidate `summary` and `c2c_summary` args ([#6723](https://github.com/open-chat-labs/open-chat/pull/6723))
- Fix case where some thread messages were not updated in stable memory ([#6736](https://github.com/open-chat-labs/open-chat/pull/6736))
- Restart migration job if threads need to be updated ([#6757](https://github.com/open-chat-labs/open-chat/pull/6757))
- Perform cycles check when migrating events to stable memory ([#6757](https://github.com/open-chat-labs/open-chat/pull/6757))

### Fixed

- Fix migrating to stable memory for chats with disappearing messages ([#6746](https://github.com/open-chat-labs/open-chat/pull/6746))

## [[2.0.1424](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1424-group)] - 2024-11-05

### Changed

- Avoid extra key lookup when iterating over events ([#6680](https://github.com/open-chat-labs/open-chat/pull/6680))
- Read events in batches when performing stable memory garbage collection ([#6682](https://github.com/open-chat-labs/open-chat/pull/6682))
- Improve efficiency of calculating latest threads per user ([#6687](https://github.com/open-chat-labs/open-chat/pull/6687))
- Avoid iterating over chat events to load mentions ([#6690](https://github.com/open-chat-labs/open-chat/pull/6690))
- Read events from stable memory once migration is complete ([#6722](https://github.com/open-chat-labs/open-chat/pull/6722))

## [[2.0.1408](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1408-group)] - 2024-10-24

### Added

- Copy chat events into stable memory ([#6603](https://github.com/open-chat-labs/open-chat/pull/6603))
- Add more achievements ([#6631](https://github.com/open-chat-labs/open-chat/pull/6631))

### Changed

- Make searching by user and term require matching both + make more efficient ([#6612](https://github.com/open-chat-labs/open-chat/pull/6612))
- Add `message_id` and `event_index` to `MessageActivityEvent` ([#6623](https://github.com/open-chat-labs/open-chat/pull/6623))
- Fixes to activity feed ([#6627](https://github.com/open-chat-labs/open-chat/pull/6627))
- Allow LocalGroupIndex to trigger migration of chat events to stable memory ([#6642](https://github.com/open-chat-labs/open-chat/pull/6642))

### Removed

- Remove `is_bot` which has been supplanted by `user_type` ([#6650](https://github.com/open-chat-labs/open-chat/pull/6650))

### Fixed

- Fix removing link previews ([#6633](https://github.com/open-chat-labs/open-chat/pull/6633))
- Determine whether c2c call should be retried based on response error ([#6640](https://github.com/open-chat-labs/open-chat/pull/6640))
- Fix owners not receiving payments for composite payment gates ([#6652](https://github.com/open-chat-labs/open-chat/pull/6652))
- Don't send notifications to bots ([#6648](https://github.com/open-chat-labs/open-chat/pull/6648))
- Fix upgrade now that `Thread` message activity event has been deleted ([#6657](https://github.com/open-chat-labs/open-chat/pull/6657))

## [[2.0.1401](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1401-group)] - 2024-10-18

### Changed

- Only deserialize from old log state ([#6616](https://github.com/open-chat-labs/open-chat/pull/6616))

## [[2.0.1398](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1398-group)] - 2024-10-18

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Ensure members marked as lapsed in updates queries ([#6573](https://github.com/open-chat-labs/open-chat/pull/6573))
- Reduce size of responses by only returning UserIds for basic members ([#6577](https://github.com/open-chat-labs/open-chat/pull/6577))
- Remove `transaction` from serialized PrizeWinner messages ([#6578](https://github.com/open-chat-labs/open-chat/pull/6578))
- Push activity to users using `GroupedTimerJobQueue` ([#6552](https://github.com/open-chat-labs/open-chat/pull/6552))
- Return `u128` rather than `Nat` for ICRC2 ledger errors ([#6597](https://github.com/open-chat-labs/open-chat/pull/6597))
- Lapsed members don't need to be re-invited ([#6602](https://github.com/open-chat-labs/open-chat/pull/6602))

### Fixed

- Fix case where GroupIndex wasn't being notified about gate change ([#6581](https://github.com/open-chat-labs/open-chat/pull/6581))

## [[2.0.1380](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1380-group)] - 2024-10-11

### Added

- Add support for expiring access gates ([#6401](https://github.com/open-chat-labs/open-chat/pull/6401))

### Changed

- Mark prize messages as having ledger error if transfers fail ([#6500](https://github.com/open-chat-labs/open-chat/pull/6500))
- Add missing MessagePack endpoints ([#6547](https://github.com/open-chat-labs/open-chat/pull/6547))
- Reduce size of some message types when serialized ([#6559](https://github.com/open-chat-labs/open-chat/pull/6559))
- Log details whenever a prize claim results in a ledger error ([#6560](https://github.com/open-chat-labs/open-chat/pull/6560))

## [[2.0.1366](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1366-group)] - 2024-10-02

### Added

- Add MessagePack versions of all endpoints ([#6463](https://github.com/open-chat-labs/open-chat/pull/6463))

### Changed

- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Simplify prize winner messages to reduce size (part 1) ([#6449](https://github.com/open-chat-labs/open-chat/pull/6449))
- Simplify search logic and move it into `SearchIndex` struct ([#6465](https://github.com/open-chat-labs/open-chat/pull/6465))
- Return owned values from `EventsMap` in prep for switch to stable memory ([#6469](https://github.com/open-chat-labs/open-chat/pull/6469))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))

## [[2.0.1352](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1352-group)] - 2024-09-20

### Changed

- Update `send_message` args to work with MessagePack ([#6425](https://github.com/open-chat-labs/open-chat/pull/6315))
- Add `winner_count` to prizes enabling us to stop sending all winners ([#6426](https://github.com/open-chat-labs/open-chat/pull/6426))

### Fixed

- Refund prize messages that are removed due to disappearing messages ([#6427](https://github.com/open-chat-labs/open-chat/pull/6427))

## [[2.0.1350](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1350-group)] - 2024-09-16

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Disallow sending messages to chats that have an external url set ([#6369](https://github.com/open-chat-labs/open-chat/pull/6369))
- Change `cancel_invites` to mark group active ([#6390](https://github.com/open-chat-labs/open-chat/pull/6390))

### Fixed

- Ensure invited users can't contain duplicates ([#6333](https://github.com/open-chat-labs/open-chat/pull/6333))

## [[2.0.1327](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1327-group)] - 2024-09-03

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))
- Mark ProposalsBot as OC controlled bot ([#6287](https://github.com/open-chat-labs/open-chat/pull/6287))

## [[2.0.1295](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1295-group)] - 2024-08-16

### Changed

- Support next batch of achievements ([#6230](https://github.com/open-chat-labs/open-chat/pull/6230))
- Remove references to deleted users ([#6241](https://github.com/open-chat-labs/open-chat/pull/6241))

## [[2.0.1273](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1273-group)] - 2024-07-31

### Changed

- Change max channel name length from 25 to 40 chars ([#6138](https://github.com/open-chat-labs/open-chat/pull/6138))
- Configure message visibility to non-members of public groups ([#6152](https://github.com/open-chat-labs/open-chat/pull/6152))

## [[2.0.1262](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1262-group)] - 2024-07-26

### Added

- Add `Locked` gate ([#6095](https://github.com/open-chat-labs/open-chat/pull/6095))

### Changed

- Fix fee then retry transfer if fee too high ([#6063](https://github.com/open-chat-labs/open-chat/pull/6063))
- Handle transfer fee changing in either direction ([#6064](https://github.com/open-chat-labs/open-chat/pull/6064))
- Bypass gates if user is invited ([#6110](https://github.com/open-chat-labs/open-chat/pull/6110))
- Return `is_invited` when previewing a group ([#6113](https://github.com/open-chat-labs/open-chat/pull/6113))
- Use `UserType` rather than `is_bot` and `is_oc_controlled_bot` ([#6116](https://github.com/open-chat-labs/open-chat/pull/6116))
- Allow OC controlled bots to send crypto transfer messages ([#6117](https://github.com/open-chat-labs/open-chat/pull/6117))

### Fixed

- Avoid getting stuck in infinite loop trying to refund prizes ([#6080](https://github.com/open-chat-labs/open-chat/pull/6080))

## [[2.0.1245](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1245-group)] - 2024-07-18

### Added

- Support gates with multiple verifiable credentials ([#6029](https://github.com/open-chat-labs/open-chat/pull/6029))
- Allow UserIndex to send Group/Channel messages as the OpenChat Bot ([#6048](https://github.com/open-chat-labs/open-chat/pull/6048))

### Changed

- Added support for a bunch more achievements ([#6033](https://github.com/open-chat-labs/open-chat/pull/6033))

## [[2.0.1234](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1234-group)] - 2024-07-09

### Added

- Add `LifetimeDiamondMembership` access gate ([#5986](https://github.com/open-chat-labs/open-chat/pull/5986))
- Add `UniquePerson` access gate ([#5993](https://github.com/open-chat-labs/open-chat/pull/5993))
- Support composite access gates ([#5988](https://github.com/open-chat-labs/open-chat/pull/5988))

## [[2.0.1195](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1195-group)] - 2024-06-06

### Added

- Implement validation of verified credential gates ([#5825](https://github.com/open-chat-labs/open-chat/pull/5825))
- Support sending transactions using ICRC2 ([#5854](https://github.com/open-chat-labs/open-chat/pull/5854))

### Changed

- Store IC root key in groups and communities ([#5816](https://github.com/open-chat-labs/open-chat/pull/5816))
- Store `internet_identity_canister_id` in groups and communities ([#5823](https://github.com/open-chat-labs/open-chat/pull/5823))
- Default video call max duration to 1 hour ([#5824](https://github.com/open-chat-labs/open-chat/pull/5824))
- Add `credential_name` to verified credential access gates ([#5853](https://github.com/open-chat-labs/open-chat/pull/5853))

### Removed

- Remove old `prizes` field ([#5819](https://github.com/open-chat-labs/open-chat/pull/5819))

### Fixed

- Fix old failing transactions by updating `created` date ([#5799](https://github.com/open-chat-labs/open-chat/pull/5799))
- One time job to mark old video calls as ended ([#5827](https://github.com/open-chat-labs/open-chat/pull/5827))

## [[2.0.1171](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1171-group)] - 2024-05-13

### Changed

- Support prize messages with 128bit prize amounts ([#5729](https://github.com/open-chat-labs/open-chat/pull/5729))
- Don't retry c2c calls after getting a `DestinationInvalid` error ([#5732](https://github.com/open-chat-labs/open-chat/pull/5732))
- Expose count of timer jobs in metrics ([#5744](https://github.com/open-chat-labs/open-chat/pull/5744))
- Don't retry c2c calls after getting a `CanisterMethodNotFound` error ([#5747](https://github.com/open-chat-labs/open-chat/pull/5747))

## [[2.0.1153](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1153-group)] - 2024-04-23

### Added

- Add `video_call_participants` endpoint ([#5684](https://github.com/open-chat-labs/open-chat/pull/5684))

### Changed

- Add `block_level_markdown` flag to messages ([#5680](https://github.com/open-chat-labs/open-chat/pull/5680))
- Store presence kind of each video call participant ([#5682](https://github.com/open-chat-labs/open-chat/pull/5682))
- Add `block_level_markdown` to edit message args ([#5697](https://github.com/open-chat-labs/open-chat/pull/5697))
- Allow non-Diamond members to start video calls ([#5706](https://github.com/open-chat-labs/open-chat/pull/5706))
- Allow members to make video calls in existing private chats ([#5714](https://github.com/open-chat-labs/open-chat/pull/5714))
- Update `event_store` packages to v0.1.0 ([#5715](https://github.com/open-chat-labs/open-chat/pull/5715))
- Include both heap and stable memory in cycles balance check ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

### Fixed

- Fix payments which are failing due to being too old ([#5681](https://github.com/open-chat-labs/open-chat/pull/5681))
- One time job to mark video calls ended if message deleted ([#5714](https://github.com/open-chat-labs/open-chat/pull/5714))

## [[2.0.1140](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1140-group)] - 2024-04-10

### Changed

- Update `event_store` packages to latest version ([#5593](https://github.com/open-chat-labs/open-chat/pull/5593))
- Disallow deleting video call message if the call is still in progress ([#5607](https://github.com/open-chat-labs/open-chat/pull/5607))
- Refactor `c2c_can_issue_access_token` ([#5613](https://github.com/open-chat-labs/open-chat/pull/5613))
- Add `call_type` to `VideoCall` ([#5661](https://github.com/open-chat-labs/open-chat/pull/5661))
- Include `call_type` in request to get video call access token ([#5662](https://github.com/open-chat-labs/open-chat/pull/5662))

### Fixed

- One time job to mark video calls ended if message deleted ([#5612](https://github.com/open-chat-labs/open-chat/pull/5612))
- Fix DKP transfers which have the old fee ([#5614](https://github.com/open-chat-labs/open-chat/pull/5614))

## [[2.0.1121](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1121-group)] - 2024-03-21

### Fixed

- Add missing mapping for the old SNEED token ([#5581](https://github.com/open-chat-labs/open-chat/pull/5581))

## [[2.0.1117](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1117-group)] - 2024-03-21

### Added

- Push event each time a P2P swap is completed ([#5520](https://github.com/open-chat-labs/open-chat/pull/5520))
- Push event each time a user tips a message ([#5521](https://github.com/open-chat-labs/open-chat/pull/5521))
- Push event each time a user adds a reaction ([#5522](https://github.com/open-chat-labs/open-chat/pull/5522))
- Push event each time a user edits a message ([#5523](https://github.com/open-chat-labs/open-chat/pull/5523))
- Push event each time a video call is ended ([#5530](https://github.com/open-chat-labs/open-chat/pull/5530))
- Push backdated events for tips, edits, reactions, swaps + video calls ([#5541](https://github.com/open-chat-labs/open-chat/pull/5541))
- Add optional PIN for sending crypto transfers ([#5571](https://github.com/open-chat-labs/open-chat/pull/5571))
- Push backdated message events ([#5575](https://github.com/open-chat-labs/open-chat/pull/5575))

### Changed

- Check start video call permission in access_token ([#5524](https://github.com/open-chat-labs/open-chat/pull/5524))
- Update `event_store` packages to latest version ([#5535](https://github.com/open-chat-labs/open-chat/pull/5535))
- Anonymize all Group canisters in events ([#5568](https://github.com/open-chat-labs/open-chat/pull/5568))
- Fallback job to mark video calls as ended ([#5569](https://github.com/open-chat-labs/open-chat/pull/5569))

### Fixed

- Mark old video calls as having ended ([#5572](https://github.com/open-chat-labs/open-chat/pull/5572))
- Add missing mappings for ICL and ELNA ([#5580](https://github.com/open-chat-labs/open-chat/pull/5580))

## [[2.0.1096](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1096-group)] - 2024-03-08

### Added

- Implement ability to push events from Group canisters ([#5436](https://github.com/open-chat-labs/open-chat/pull/5436))
- Push event each time a message is sent ([#5439](https://github.com/open-chat-labs/open-chat/pull/5439))
- Push backdated message events ([#5441](https://github.com/open-chat-labs/open-chat/pull/5441))
- Add 'start_video_call' endpoint ([#5470](https://github.com/open-chat-labs/open-chat/pull/5470))

### Changed

- Use ICRC1 for ICP transactions between users ([#5426](https://github.com/open-chat-labs/open-chat/pull/5426))
- Add more details to message event payloads ([#5447](https://github.com/open-chat-labs/open-chat/pull/5447))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Don't send video call notification to user who started the call ([#5462](https://github.com/open-chat-labs/open-chat/pull/5462))
- Use initiator as sender for video calls rather than VideoCallBot ([#5477](https://github.com/open-chat-labs/open-chat/pull/5477))
- Set `anonymized_id` in `post_upgrade` ([#5478](https://github.com/open-chat-labs/open-chat/pull/5478))
- Simplify `start_video_call` responses ([#5479](https://github.com/open-chat-labs/open-chat/pull/5479))
- Join video calls by `message_id` rather than `message_index` ([#5482](https://github.com/open-chat-labs/open-chat/pull/5482))
- Add `start_video_call` permission ([#5488](https://github.com/open-chat-labs/open-chat/pull/5488))
- Push message events from within `chat_events` ([#5494](https://github.com/open-chat-labs/open-chat/pull/5494))

## [[2.0.1076](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1076-group)] - 2024-02-22

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))
- Transfer prizes to community during import ([#5317](https://github.com/open-chat-labs/open-chat/pull/5317))
- VideoCall message + permission + summary/updates ([#5357](https://github.com/open-chat-labs/open-chat/pull/5357))
- Endpoints to join and end video calls ([#5374](https://github.com/open-chat-labs/open-chat/pull/5374))
- Add `c2c_can_access_group` endpoint ([#5398](https://github.com/open-chat-labs/open-chat/pull/5398))

### Changed

- Hack to cater for SNEED's unique handling of transfer fees ([#5280](https://github.com/open-chat-labs/open-chat/pull/5280))
- Add `minimum_yes_proportion_of_total` to SNS proposals ([#5284](https://github.com/open-chat-labs/open-chat/pull/5284))
- Allow video call operator to send to all groups ([#5389](https://github.com/open-chat-labs/open-chat/pull/5389))
- End video call by `MessageId` ([#5401](https://github.com/open-chat-labs/open-chat/pull/5401))

## [[2.0.1022](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1022-group)] - 2024-01-24

### Changed

- Simplify timer jobs + make them more efficient ([#5233](https://github.com/open-chat-labs/open-chat/pull/5233))
- Avoid sending prize winner notifications ([#5236](https://github.com/open-chat-labs/open-chat/pull/5236))
- Add timer job to mark P2P swaps as expired ([#5246](https://github.com/open-chat-labs/open-chat/pull/5246))

### Fixed

- Fix p2p swaps in threads which weren't being marked as updated ([#5235](https://github.com/open-chat-labs/open-chat/pull/5235))

## [[2.0.1016](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1016-group)] - 2024-01-19

### Added

- Show proposal payloads for NNS proposals ([#5072](https://github.com/open-chat-labs/open-chat/pull/5072))
- Add TokenBalance access gate ([#5120](https://github.com/open-chat-labs/open-chat/pull/5120))
- Expose details of timer jobs for public Groups ([#5154](https://github.com/open-chat-labs/open-chat/pull/5154))
- Notify group when p2p swap status changes ([#5201](https://github.com/open-chat-labs/open-chat/pull/5201))
- Implement `cancel_p2p_swap` for groups ([#5204](https://github.com/open-chat-labs/open-chat/pull/5204))

### Changed

- Don't mark messages as edited if only link removed ([#5119](https://github.com/open-chat-labs/open-chat/pull/5119))
- Increase max message length to 10k characters ([#5140](https://github.com/open-chat-labs/open-chat/pull/5140))
- Return success from `deleted_message` even if message not deleted ([#5145](https://github.com/open-chat-labs/open-chat/pull/5145))
- Change `expires_at` to `expires_in` for p2p trade initial ([#5147](https://github.com/open-chat-labs/open-chat/pull/5147))
- Use `message_id` in `accept_p2p_trade_offer` args ([#5162](https://github.com/open-chat-labs/open-chat/pull/5162))
- Ensure swap responses contain all transaction ids ([#5174](https://github.com/open-chat-labs/open-chat/pull/5174))
- Use "swap" instead of "trade" in vars and types ([#5175](https://github.com/open-chat-labs/open-chat/pull/5175))
- Only use transaction index for p2p swaps and drop usage of hash ([#5203](https://github.com/open-chat-labs/open-chat/pull/5203))

### Fixed

- Prevent latest messages of payment gated groups from being public ([#5080](https://github.com/open-chat-labs/open-chat/pull/5080))
- Fix bug where `cancel_job` would fail to find the job to cancel ([#5148](https://github.com/open-chat-labs/open-chat/pull/5148))

## [[2.0.986](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.986-group)] - 2023-12-19

### Added

- Support getting batches of summary updates via LocalUserIndex ([#4983](https://github.com/open-chat-labs/open-chat/pull/4983))
- Add support for P2P trades ([#4897](https://github.com/open-chat-labs/open-chat/pull/4897))

### Changed

- Reduce cut of payment gate fee for SNS from 20% -> 2% ([#4991](https://github.com/open-chat-labs/open-chat/pull/4991))
- Suppress notifications and @s for suspect messages ([#5006](https://github.com/open-chat-labs/open-chat/pull/5006))
- Make Diamond membership gate check synchronous ([#5027](https://github.com/open-chat-labs/open-chat/pull/5027))

### Fixed

- Fix for NNS proposal deadlines not being updated ([#4978](https://github.com/open-chat-labs/open-chat/pull/4978))
- Fix incorrect `local_user_index_canister_id` values ([#5009](https://github.com/open-chat-labs/open-chat/pull/5009))

## [[2.0.966](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.966-group)] - 2023-12-07

### Fixed

- Fix bug which allowed anyone to mention @everyone ([#4930](https://github.com/open-chat-labs/open-chat/pull/4930))

## [[2.0.957](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.957-group)] - 2023-12-05

### Added

- Add `c2c_send_message` with improved API for c2c calls vs `send_message_v2` ([#4895](https://github.com/open-chat-labs/open-chat/pull/4895))

### Changed

- Burn any CHAT going to the treasury ([#4891](https://github.com/open-chat-labs/open-chat/pull/4891))
- Move prize winner messages to be in a thread on each prize message ([#4915](https://github.com/open-chat-labs/open-chat/pull/4915))

## [[2.0.950](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.950-group)] - 2023-11-28

### Added

- Support getting batches of chat events via LocalUserIndex ([#4848](https://github.com/open-chat-labs/open-chat/pull/4848))

### Changed

- Make events private for payment gated chats ([#4843](https://github.com/open-chat-labs/open-chat/pull/4843))
- In modclub reports only show public message links ([#4847](https://github.com/open-chat-labs/open-chat/pull/4847))
- Add `local_user_index_canister_id` to group summaries ([#4857](https://github.com/open-chat-labs/open-chat/pull/4857))

## [[2.0.946](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.946-group)] - 2023-11-24

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

## [[2.0.931](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.931-group)] - 2023-11-09

### Changed

- Refund remaining prizes early if message gets deleted ([#4708](https://github.com/open-chat-labs/open-chat/pull/4708))
- Add `events_ttl_last_updated` to chat summaries ([#4711](https://github.com/open-chat-labs/open-chat/pull/4711))
- Support UserIndex calling `delete_messages` ([#4713](https://github.com/open-chat-labs/open-chat/pull/4713))
- Simplify and improve the @everyone Regex ([#4714](https://github.com/open-chat-labs/open-chat/pull/4714))
- Extend `c2c_report_message` endpoint ([#4719](https://github.com/open-chat-labs/open-chat/pull/4719))
- Don't collect reason or notes from reporter ([#4724](https://github.com/open-chat-labs/open-chat/pull/4724))
- Improve `ReplicaNotUpToDate` check to avoid displaying outdated events ([#4727](https://github.com/open-chat-labs/open-chat/pull/4727))
- Add `membership` to group summaries to support anonymous mode ([#4730](https://github.com/open-chat-labs/open-chat/pull/4730))
- Consolidate logic to update thread summaries ([#4736](https://github.com/open-chat-labs/open-chat/pull/4736))

## [[2.0.922](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.922-group)] - 2023-11-02

### Added

- Add `report_message` endpoint ([#4691](https://github.com/open-chat-labs/open-chat/pull/4691))

### Changed

- Reduce size of message content when serialized ([#4680](https://github.com/open-chat-labs/open-chat/pull/4680))
- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Make `events_map` generic in preparation for moving it to stable memory ([#4689](https://github.com/open-chat-labs/open-chat/pull/4689))
- Add `latest_message_index` to chat summaries ([#4693](https://github.com/open-chat-labs/open-chat/pull/4693))
- Allow deleting all message types ([#4697](https://github.com/open-chat-labs/open-chat/pull/4697))

## [[2.0.914](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.914-group)] - 2023-10-27

### Fixed

- Fix sending of proposal messages ([#4662](https://github.com/open-chat-labs/open-chat/pull/4662))

## [[2.0.910](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.910-group)] - 2023-10-27

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

## [[2.0.888](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.888-group)] - 2023-10-18

### Added

- Add optional `diamond_only` filter to prize messages ([#4587](https://github.com/open-chat-labs/open-chat/pull/4587))

### Changed

- Allow @everyone to be followed by some punctuation ([#4553](https://github.com/open-chat-labs/open-chat/pull/4553))
- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))
- Set memo based on transaction type ([#4603](https://github.com/open-chat-labs/open-chat/pull/4603))

### Removed

- Removed `c2c_toggle_mute_notifications` ([#4513](https://github.com/open-chat-labs/open-chat/pull/4513))

## [[2.0.874](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.874-group)] - 2023-10-06

### Changed

- Notifications for custom messages should use the sub-type ([#4465](https://github.com/open-chat-labs/open-chat/pull/4465))
- Support prize messages in any token by getting fee from original transfer ([#4470](https://github.com/open-chat-labs/open-chat/pull/4470))
- Refund any prize message balance once it has ended ([#4476](https://github.com/open-chat-labs/open-chat/pull/4476))
- Switch crypto messages to only contain completed transactions ([#4489](https://github.com/open-chat-labs/open-chat/pull/4489))

## [[2.0.865](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.865-group)] - 2023-09-27

### Added

- Implement tipping messages ([#4420](https://github.com/open-chat-labs/open-chat/pull/4420))
- Implement notifications for message tips ([#4427](https://github.com/open-chat-labs/open-chat/pull/4427))
- Implement follow/unfollow thread ([#4431](https://github.com/open-chat-labs/open-chat/pull/4431))

### Changed

- Disable mentions for messages sent by the ProposalsBot ([#4424](https://github.com/open-chat-labs/open-chat/pull/4424))
- Simplify `inspect_message` ([#4436](https://github.com/open-chat-labs/open-chat/pull/4436))
- Use canister timers to remove expired events ([#4447](https://github.com/open-chat-labs/open-chat/pull/4447))

### Fixed

- Fix case where you can receive a notification for your own message ([#4425](https://github.com/open-chat-labs/open-chat/pull/4425))

## [[2.0.855](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.855-group)] - 2023-09-21

### Added

- Add `mention_all_members` group permission ([#4405](https://github.com/open-chat-labs/open-chat/pull/4405))

### Changed

- Support `@everyone` mentions ([#4405](https://github.com/open-chat-labs/open-chat/pull/4405))

## [[2.0.851](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.851-group)] - 2023-09-18

### Changed

- Move `InstructionCountsLog` into its own library ([#4348](https://github.com/open-chat-labs/open-chat/pull/4348))
- Move rules enabled into Details response + related ([#4366](https://github.com/open-chat-labs/open-chat/pull/4366))
- Allow rules to be changed without changing version ([#4374](https://github.com/open-chat-labs/open-chat/pull/4374))

## [[2.0.831](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.831-group)] - 2023-09-01

### Added

- Add optional user `display name` ([#4247](https://github.com/open-chat-labs/open-chat/pull/4247))

## [[2.0.818](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.818-group)] - 2023-08-24

### Added

- Support making private groups / channels public ([#4223](https://github.com/open-chat-labs/open-chat/pull/4223))

### Changed

- Optimise `selected_updates` for query caching ([#4185](https://github.com/open-chat-labs/open-chat/pull/4185))
- Extend versioned rules to communities and groups ([#4219](https://github.com/open-chat-labs/open-chat/pull/4219))

### Removed

- Remove `selected_updates` which has been superseded by `selected_updates_v2` ([#4182](https://github.com/open-chat-labs/open-chat/pull/4182))

### Fixed

- Fix for owners not being able to demote other owners ([#4227](https://github.com/open-chat-labs/open-chat/pull/4227))

## [[2.0.809](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.809-group)] - 2023-08-15

### Changed

- Convert remaining SNS transactions to ICRC1 ([#4175](https://github.com/open-chat-labs/open-chat/pull/4175))

## [[2.0.807](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.807-group)] - 2023-08-11

### Changed

- Access rules data structure changed ([#4159](https://github.com/open-chat-labs/open-chat/pull/4159))

### Removed

- Remove SNS transaction types ([#4162](https://github.com/open-chat-labs/open-chat/pull/4162))

## [[2.0.802](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.802-group)] - 2023-08-08

### Changed

- Serialize chat state more efficiently ([#4092](https://github.com/open-chat-labs/open-chat/pull/4092))
- More efficient serialization of notifications ([#4134](https://github.com/open-chat-labs/open-chat/pull/4134))
- Simplify notification types ([#4148](https://github.com/open-chat-labs/open-chat/pull/4148))
- Validate text length based on number of chars rather than bytes ([#4154](https://github.com/open-chat-labs/open-chat/pull/4154))

### Removed

- Remove `make_private` which is superseded by `update_group` ([#4122](https://github.com/open-chat-labs/open-chat/pull/4122))

## [[2.0.774](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.774-group)] - 2023-07-31

### Changed

- Serialize bytes more efficiently when importing group to community ([#4080](https://github.com/open-chat-labs/open-chat/pull/4080))
- Allow retrying the failed group imports ([#4084](https://github.com/open-chat-labs/open-chat/pull/4084))
- Make `c2c_export_group` an update call to perform cycles check ([#4086](https://github.com/open-chat-labs/open-chat/pull/4086))

## [[2.0.763](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.763-group)] - 2023-07-19

### Changed

- Convert SNS transaction messages into ICRC1 messages ([#4015](https://github.com/open-chat-labs/open-chat/pull/4015))
- Trim messages before pushing them as notifications ([#4020](https://github.com/open-chat-labs/open-chat/pull/4020))
- Support sending any ICRC1 tokens ([#4026](https://github.com/open-chat-labs/open-chat/pull/4026))

## [[2.0.745](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.745-group)] - 2023-07-19

### Added

- Add language field to community ([#3923](https://github.com/open-chat-labs/open-chat/pull/3923))

### Changed

- Refactored `claim_prize` ([#3854](https://github.com/open-chat-labs/open-chat/pull/3854))
- Add `ledger` to pending crypto transactions ([#3866](https://github.com/open-chat-labs/open-chat/pull/3866))
- Extended `update_group_v2` to set group visibility ([#3880](https://github.com/open-chat-labs/open-chat/pull/3880))
- Deprecate the `block_users` and `change_permissions` permissions ([#3922](https://github.com/open-chat-labs/open-chat/pull/3922))
- Add `channel_id` to `convert_into_community` response ([#3929](https://github.com/open-chat-labs/open-chat/pull/3929))
- Check user is Diamond before converting group into community ([#3932](https://github.com/open-chat-labs/open-chat/pull/3932))
- Call into ICP ledger via the new `icp_ledger_canister_c2c_client` ([#3966](https://github.com/open-chat-labs/open-chat/pull/3966))
- Stop using `transaction_hash` field on SNS transactions ([#3967](https://github.com/open-chat-labs/open-chat/pull/3967))
- Remove dependencies on IC repo ([#3970](https://github.com/open-chat-labs/open-chat/pull/3970))
- Set community avatar after converting group into community ([#3976](https://github.com/open-chat-labs/open-chat/pull/3976))
- Use `canister_client` for making all c2c calls ([#3979](https://github.com/open-chat-labs/open-chat/pull/3979))
- Avoid using `candid::Func` type directly ([#3983](https://github.com/open-chat-labs/open-chat/pull/3983))
- Add `ledger` field to completed crypto transactions ([#3912](https://github.com/open-chat-labs/open-chat/pull/3912))

### Removed

- Remove deprecated event types ([#3862](https://github.com/open-chat-labs/open-chat/pull/3862))

## [[2.0.735](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.735-group)] - 2023-06-27

### Added

- Add ability to import a group into a community ([#3792](https://github.com/open-chat-labs/open-chat/pull/3792))
- Add support for sending the KINIC token ([#3811](https://github.com/open-chat-labs/open-chat/pull/3811))
- Support replying to channel messages ([#3825](https://github.com/open-chat-labs/open-chat/pull/3825))
- Support simplified transfers of icrc1 tokens ([#3827](https://github.com/open-chat-labs/open-chat/pull/3827))
- Implement converting a group into a community ([#3833](https://github.com/open-chat-labs/open-chat/pull/3833))
- Add `c2c_report_message_v2` to handle groups and channels ([#3842](https://github.com/open-chat-labs/open-chat/pull/3842))
- Special case the ProposalsBot when importing into a community ([#3844](https://github.com/open-chat-labs/open-chat/pull/3844))

### Changed

- Allow blocking users who are no longer in the group ([#3818](https://github.com/open-chat-labs/open-chat/pull/3818))
- Sync access gate with group_index ([#3826](https://github.com/open-chat-labs/open-chat/pull/3826))
- Simplify `c2c_delete_group` ([#3840](https://github.com/open-chat-labs/open-chat/pull/3840))

### Removed

- Drop `member_count_change` from group activity ([#3820](https://github.com/open-chat-labs/open-chat/pull/3820))

## [[2.0.724](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.724-group)] - 2023-06-16

### Changed

- Add `GroupRoleInternal` for efficient serialization ([#3772](https://github.com/open-chat-labs/open-chat/pull/3772))
- Trim deprecated chat events to save space ([#3773](https://github.com/open-chat-labs/open-chat/pull/3773))
- Further reductions to the size of serialized ChatEvents ([#3775](https://github.com/open-chat-labs/open-chat/pull/3775))
- Reduce size of `GroupMembers` when serialized ([#3778](https://github.com/open-chat-labs/open-chat/pull/3778))
- Reduce size of `ChatMetrics` when serialized ([#3779](https://github.com/open-chat-labs/open-chat/pull/3779))
- Reduce size of mentions when serialized ([#3784](https://github.com/open-chat-labs/open-chat/pull/3784))
- Add `created_by` to `GroupChatCore` ([#3786](https://github.com/open-chat-labs/open-chat/pull/3786))
- Refactor core summaries logic ([#3791](https://github.com/open-chat-labs/open-chat/pull/3791))
- Deserialize onto old `ChatEventInternal` types then map to new ([#3798](https://github.com/open-chat-labs/open-chat/pull/3798))
- Temporarily reinstate deprecated `cycles_messages` field ([#3801](https://github.com/open-chat-labs/open-chat/pull/3801))

## [[2.0.716](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.716-group)] - 2023-06-12

### Added

- Add `selected_updates_v2` ([#3732](https://github.com/open-chat-labs/open-chat/pull/3732))
- Record instruction counts during upgrades ([#3758](https://github.com/open-chat-labs/open-chat/pull/3758))

### Changed

- Move invite_users logic into GroupChatCore ([#3716](https://github.com/open-chat-labs/open-chat/pull/3716))
- Refactor so that invited user principals moved out of GroupChatCore ([#3727](https://github.com/open-chat-labs/open-chat/pull/3727))
- Move `updates_from_events` logic into GroupChatCore ([#3730](https://github.com/open-chat-labs/open-chat/pull/3730))
- Use FireAndForgetHandler for activity notification ([#3755](https://github.com/open-chat-labs/open-chat/pull/3755))
- Make (de)serializing events + users more efficient ([#3756](https://github.com/open-chat-labs/open-chat/pull/3756))

### Fixed

- Fix `is_user_an_owner` check ([#3761](https://github.com/open-chat-labs/open-chat/pull/3761))

## [[2.0.713](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.713-group)] - 2023-06-02

### Changed

- Move invited_users from Data to GroupChatCore ([#3714](https://github.com/open-chat-labs/open-chat/pull/3714))

### Fixed

- Fix bug where user could be not found for c2c calls ([#3712](https://github.com/open-chat-labs/open-chat/pull/3712))

## [[2.0.705](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.705-group)] - 2023-06-01

### Added

- Introduce `FireAndForgetHandler` which retries failed c2c calls ([#3639](https://github.com/open-chat-labs/open-chat/pull/3639))

### Changed

- Split common group logic into new `group_chat_core` library ([#3620](https://github.com/open-chat-labs/open-chat/pull/3620)), ([#3622](https://github.com/open-chat-labs/open-chat/pull/3622)), ([#3624](https://github.com/open-chat-labs/open-chat/pull/3624)), ([#3626](https://github.com/open-chat-labs/open-chat/pull/3626)), ([#3633](https://github.com/open-chat-labs/open-chat/pull/3633)), ([#3634](https://github.com/open-chat-labs/open-chat/pull/3634)), ([#3662](https://github.com/open-chat-labs/open-chat/pull/3662)), ([#3665](https://github.com/open-chat-labs/open-chat/pull/3665)), ([#3667](https://github.com/open-chat-labs/open-chat/pull/3667)), ([#3668](https://github.com/open-chat-labs/open-chat/pull/3668))
- Simplify `c2c_update_proposals` ([#3621](https://github.com/open-chat-labs/open-chat/pull/3621))
- Simplify `remove_participant` ([#3641](https://github.com/open-chat-labs/open-chat/pull/3641))
- Avoid multi subnet calls when (un)muting group notifications ([#3685](https://github.com/open-chat-labs/open-chat/pull/3685))
- Refactor search ([#3689](https://github.com/open-chat-labs/open-chat/pull/3689))
- Don't send notifications to suspended users ([#3704](https://github.com/open-chat-labs/open-chat/pull/3704))

### Removed

- Remove last remnants of `send_message` and `edit_message` ([#3603](https://github.com/open-chat-labs/open-chat/pull/3603))

## [[2.0.690](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.690-group)] - 2023-05-16

### Changed

- Return `history_visible_to_new_joiners` from `group::public_summary` ([#3572](https://github.com/open-chat-labs/open-chat/pull/3572))
- Added `moderator` role and removed `add_members` permission ([#3592](https://github.com/open-chat-labs/open-chat/pull/3592))
- Put back `add_members` permission with serde default ([#3599](https://github.com/open-chat-labs/open-chat/pull/3599))

### Removed

- Remove `send_message` and `edit_message` (there are now `v2` versions) ([#3578](https://github.com/open-chat-labs/open-chat/pull/3578))
- Remove `add_participants` endpoint ([#3589](https://github.com/open-chat-labs/open-chat/pull/3589))

### Fixed

- Fix issue with group accessibility ([#3600](https://github.com/open-chat-labs/open-chat/pull/3600))

## [[2.0.686](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.686-group)] - 2023-05-11

### Added

- Re-introduce invite by code on backend ([#3552](https://github.com/open-chat-labs/open-chat/pull/3552))

### Changed

- Short circuit without calling `ic0.time()` if there have been no updates ([#3539](https://github.com/open-chat-labs/open-chat/pull/3539))
- Short circuit query calls prior to calling `ic0.time()` where possible ([#3542](https://github.com/open-chat-labs/open-chat/pull/3542))
- Invited users can't see private group messages ([#3558](https://github.com/open-chat-labs/open-chat/pull/3558))
- Handle `send_message_v2` and `edit_message_v2` in `inspect_message` ([#3560](https://github.com/open-chat-labs/open-chat/pull/3560))

## [[2.0.675](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.675-group)] - 2023-04-29

### Added

- Implement `edit_message_v2` ([#3504](https://github.com/open-chat-labs/open-chat/pull/3504))
- Supports inviting of specific users ([#3499](https://github.com/open-chat-labs/open-chat/pull/3499))

### Changed

- Use hardcoded ledger ids ([#3452](https://github.com/open-chat-labs/open-chat/pull/3452))
- Allow platform moderators to delete any messages ([#3491](https://github.com/open-chat-labs/open-chat/pull/3491))
- Allow the user index to add group members ([#3493](https://github.com/open-chat-labs/open-chat/pull/3493))
- Added `created` to pending transactions ([#3494](https://github.com/open-chat-labs/open-chat/pull/3494))
- Added ability to `report_message` ([#3497](https://github.com/open-chat-labs/open-chat/pull/3497))
- Only return full details for the first 10 message reports ([#3505](https://github.com/open-chat-labs/open-chat/pull/3505))
- Relax restrictions on who can claim prizes ([#3516](https://github.com/open-chat-labs/open-chat/pull/3516))

### Removed

- Removed invite to private group by link/code ([#3499](https://github.com/open-chat-labs/open-chat/pull/3499))

## [[2.0.662](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.662-group)] - 2023-04-16

### Added

- Implement 'Gated Groups' ([#3406](https://github.com/open-chat-labs/open-chat/pull/3406))
- Added `register_proposal_vote_v2` for voting on proposals directly from the frontend ([#3413](https://github.com/open-chat-labs/open-chat/pull/3413))
- Added `Empty` event type ([#3439](https://github.com/open-chat-labs/open-chat/pull/3439))
- Added new message content types for reminders ([#3440](https://github.com/open-chat-labs/open-chat/pull/3440))
- Added new `Custom` message content type ([#3445](https://github.com/open-chat-labs/open-chat/pull/3445))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-chat-labs/open-chat/pull/3375))
- Removed `affected_events` which has been superseded by `updated_events` ([#3419](https://github.com/open-chat-labs/open-chat/pull/3419))

## [[2.0.644](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.644-group)] - 2023-03-24

### Added

- Return group summary if user tries to join group they are already in ([#3296](https://github.com/open-chat-labs/open-chat/pull/3296))
- Store and use last updated timestamp on each event ([#3326](https://github.com/open-chat-labs/open-chat/pull/3326))
- Added `timestamp` to `EventsResponse` ([#3329](https://github.com/open-chat-labs/open-chat/pull/3329))

### Changed

- Support multiple group owners ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))
- Platform mods can become owners of public groups ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248)) & ([#3251](https://github.com/open-chat-labs/open-chat/pull/3251))
- Removed all the code around reinstalling groups ([#3253](https://github.com/open-chat-labs/open-chat/pull/3253))
- Removed `affected_events` from event responses ([#3322](https://github.com/open-chat-labs/open-chat/pull/3322))
- Removed super_admin role from groups([#3319](https://github.com/open-chat-labs/open-chat/pull/3319))

## [[2.0.619](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.619-group)] - 2023-02-28

### Added

- Added `payload_text_rendering` to SNS proposals ([#3175](https://github.com/open-chat-labs/open-chat/pull/3175))
- Push activity notification when (un)freezing a group ([#3195](https://github.com/open-chat-labs/open-chat/pull/3195))
- Add CHAT ledger to user and group canisters ([#3222](https://github.com/open-chat-labs/open-chat/pull/3222))

### Fixed

- Set all `notifications_muted` dates to `now` to fix data inconsistency ([#3227](https://github.com/open-chat-labs/open-chat/pull/3227))

## [[2.0.606](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.606-group)] - 2023-02-20

### Fixed

- Handle the invalid users who joined groups before we had a check in place ([#3162](https://github.com/open-chat-labs/open-chat/pull/3162))

## [[2.0.604](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.604-group)] - 2023-02-17

### Added

- Added `c2c_initialize_events` for recovering groups which are un-upgradable due to bug in `pre_upgrade` ([#3128](https://github.com/open-chat-labs/open-chat/pull/3128))
- Added `c2c_events_internal` for recovering group events ([#3138](https://github.com/open-chat-labs/open-chat/pull/3138))
- Added `c2c_name_and_members` which is called by the GroupIndex before deleting the group ([#3144](https://github.com/open-chat-labs/open-chat/pull/3144))

### Removed

- Removed code to initialize `proposals_bot_user_id` value ([#3124](https://github.com/open-chat-labs/open-chat/pull/3124))

### Fixed

- Fixed latest message not being returned when getting updates ([#3120](https://github.com/open-chat-labs/open-chat/pull/3120))
- Fix-up ledger ids ([#3143](https://github.com/open-chat-labs/open-chat/pull/3143))

## [[2.0.589](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.589-group)] - 2023-02-10

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))
- Drop stable memory after upgrade ([#3116](https://github.com/open-chat-labs/open-chat/pull/3116))

## [[2.0.583](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.583-group)] - 2023-02-09

### Changed

- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Only allow proposal messages sent by the ProposalsBot ([#3080](https://github.com/open-chat-labs/open-chat/pull/3080))
- Add "claim_prize" to group inspect_message ([#3084](https://github.com/open-chat-labs/open-chat/pull/3084))

## [[2.0.579](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.579-group)] - 2023-02-06

### Added

- Added transaction details to `PrizeWinnerContent` ([#3055](https://github.com/open-chat-labs/open-chat/pull/3055))

### Changed

- Reduce min interval between cycles balance checks ([#3058](https://github.com/open-chat-labs/open-chat/pull/3058))
- Deserialize using `MemoryManager` within `post_upgrade` ([#3066](https://github.com/open-chat-labs/open-chat/pull/3066))
- Reduce `MemoryManager` bucket size to 1 wasm page ([#3070](https://github.com/open-chat-labs/open-chat/pull/3070))

### Removed

- Removed one-time code to fix incorrect ICP transaction hashes ([#3063](https://github.com/open-chat-labs/open-chat/pull/3063))
- Removed one-time code to migrate `chat_events` to the new format ([#3064](https://github.com/open-chat-labs/open-chat/pull/3064))

## [[2.0.577](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.577-group)] - 2023-02-03

### Added

- Added `disappears_at` to events ([#3021](https://github.com/open-chat-labs/open-chat/pull/3021))
- Support disappearing messages ([#3029](https://github.com/open-chat-labs/open-chat/pull/3029))
- Added support for "prize" messages ([#3044](https://github.com/open-chat-labs/open-chat/pull/3044))

### Changed

- Refactor and simplify `chat_events` ([#3013](https://github.com/open-chat-labs/open-chat/pull/3013))
- Mark group as active after ending a poll ([#3017](https://github.com/open-chat-labs/open-chat/pull/3017))
- Renamed `disappears_at` to `expires_at` ([#3023](https://github.com/open-chat-labs/open-chat/pull/3023))
- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Fixed

- One time job to fix incorrect ICP transaction hashes ([#3035](https://github.com/open-chat-labs/open-chat/pull/3035))
- Fix 'double borrowing' error when hard deleting files ([#3051](https://github.com/open-chat-labs/open-chat/pull/3051))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))
- Removed `events_range` ([#3011](https://github.com/open-chat-labs/open-chat/pull/3011))

## [[2.0.552](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.552-group)] - 2023-01-20

### Added

- Add SNS1 token to backend ([#2975](https://github.com/open-chat-labs/open-chat/pull/2975))
- Add ckBTC token to backend ([#2981](https://github.com/open-chat-labs/open-chat/pull/2981))

### Changed

- Skip processing notifications with no recipients ([#2979](https://github.com/open-chat-labs/open-chat/pull/2979))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))

### Removed

- Removed `join_group_v2` which has been superseded by the new `join_group` ([#2966](https://github.com/open-chat-labs/open-chat/pull/2966))

## [[2.0.546](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.546-group)] - 2023-01-08

### Added

- Allow admins and senders to see deleted message content ([#2922](https://github.com/open-chat-labs/open-chat/pull/2922))

### Changed

- Added `max_messages` to `events` and `events_window` ([#2947](https://github.com/open-chat-labs/open-chat/pull/2947))

### Removed

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-chat-labs/open-chat/pull/2954))
