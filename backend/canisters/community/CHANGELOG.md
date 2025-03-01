# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1618](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1618-community)] - 2025-02-28

### Added

- Add api_key query endpoint callable by owner(s) ([#7431](https://github.com/open-chat-labs/open-chat/pull/7431))
- Support `sync_api_key` cmd + min required cmd role ([#7439](https://github.com/open-chat-labs/open-chat/pull/7439))
- Introduce `IdempotencyChecker` in preparation for using best-effort calls ([#7457](https://github.com/open-chat-labs/open-chat/pull/7457))
- Introduce new idempotent endpoints for C2C calls ([#7492](https://github.com/open-chat-labs/open-chat/pull/7492))
- Add `c2c_bot_channel_details` ([#7499](https://github.com/open-chat-labs/open-chat/pull/7499))

### Changed

- Expose channel count in metrics ([#7390](https://github.com/open-chat-labs/open-chat/pull/7390))
- Serialize notifications using MessagePack rather than Candid ([#7445](https://github.com/open-chat-labs/open-chat/pull/7445))
- Reduce the size of notifications when serialized ([#7448](https://github.com/open-chat-labs/open-chat/pull/7448))
- Move new message validation to `MessageContentInternal` ([#7452](https://github.com/open-chat-labs/open-chat/pull/7452))
- Encode permissions within bot API keys as bitflags ([#7456](https://github.com/open-chat-labs/open-chat/pull/7456))
- Channel summaries updated when api keys generated ([#7478](https://github.com/open-chat-labs/open-chat/pull/7478))

### Removed

- Remove the old `start_video_call` and `end_video_call` endpoints ([#7399](https://github.com/open-chat-labs/open-chat/pull/7399))

## [[2.0.1605](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1605-community)] - 2025-02-10

### Fixed

- Fix community member role change ([#7381](https://github.com/open-chat-labs/open-chat/pull/7381))

## [[2.0.1601](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1601-community)] - 2025-02-06

### Added

- Add `c2c_bot_create_channel` endpoint ([#7354](https://github.com/open-chat-labs/open-chat/pull/7354))
- Add `c2c_bot_delete_channel` endpoint ([#7359](https://github.com/open-chat-labs/open-chat/pull/7359))

### Changed

- Introduce new `Integer` bot parameter type ([#7296](https://github.com/open-chat-labs/open-chat/pull/7296))
- Restructure to handle autonomous bots ([#7318](https://github.com/open-chat-labs/open-chat/pull/7318))
- Add `sender` to notifications to support blocking notifications from blocked users ([#7330](https://github.com/open-chat-labs/open-chat/pull/7330))
- Expose each bot action as a separate endpoint ([#7345](https://github.com/open-chat-labs/open-chat/pull/7345))
- Send OC's share of access gate joining fees to the treasury canister ([#7353](https://github.com/open-chat-labs/open-chat/pull/7353))
- Ensure message Ids have successfully been deduped ([#7355](https://github.com/open-chat-labs/open-chat/pull/7355))
- Avoid storing achievements for users who leave the group ([#7356](https://github.com/open-chat-labs/open-chat/pull/7356))

### Fixed

- Avoid retrying c2c call if recipient canister is uninstalled ([#7302](https://github.com/open-chat-labs/open-chat/pull/7302))
- Fix channels still appearing in channel list after being deleted ([#7351](https://github.com/open-chat-labs/open-chat/pull/7351))
- Fix `c2c_can_issue_access_token` ([#7366](https://github.com/open-chat-labs/open-chat/pull/7366))

## [[2.0.1580](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1580-community)] - 2025-01-24

### Changed

- Make messageId deduping faster and avoid incorrectly exiting batch early ([#7295](https://github.com/open-chat-labs/open-chat/pull/7295))

## [[2.0.1579](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1579-community)] - 2025-01-23

### Added

- Add facility to set/revoke community verification via proposal ([#7240](https://github.com/open-chat-labs/open-chat/pull/7240))

### Changed

- Reduce message Ids to 64 bits down from 128 bits ([#7232](https://github.com/open-chat-labs/open-chat/pull/7232))
- Reduce channel Ids to 32 bits down from 128 bits ([#7233](https://github.com/open-chat-labs/open-chat/pull/7233))
- Add `start_video_call_v2` and `end_video_call_v2` with reduced arg sizes ([#7236](https://github.com/open-chat-labs/open-chat/pull/7236))
- Remove dangling member <-> channel links ([#7246](https://github.com/open-chat-labs/open-chat/pull/7246))
- Disallow forwarding prize messages and governance proposal messages ([#7260](https://github.com/open-chat-labs/open-chat/pull/7260))
- Sync bot installation with UserIndex ([#7291](https://github.com/open-chat-labs/open-chat/pull/7291))

### Fixed

- De-duplicate messageIds using a timer job ([#7275](https://github.com/open-chat-labs/open-chat/pull/7275))

## [[2.0.1570](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1570-community)] - 2025-01-14

### Changed

- Join users to new channels in batches to handle large communities ([#7125](https://github.com/open-chat-labs/open-chat/pull/7125))
- Log error if tip fails due to recipient mismatch ([#7151](https://github.com/open-chat-labs/open-chat/pull/7151))
- Log response if `delete_channel` fails ([#7152](https://github.com/open-chat-labs/open-chat/pull/7152))
- Introduce `StableMemoryMap` trait to simplify storing in stable memory ([#7176](https://github.com/open-chat-labs/open-chat/pull/7176))
- When disappearing messages expire delete any linked files ([#7184](https://github.com/open-chat-labs/open-chat/pull/7184))
- Use typed command in `BotCommandClaims` ([#7113](https://github.com/open-chat-labs/open-chat/pull/7113))
- Use macro to create grouped timer job types ([#7224](https://github.com/open-chat-labs/open-chat/pull/7224))

### Fixed

- Return correct `last_updated` date after importing group into community ([#7193](https://github.com/open-chat-labs/open-chat/pull/7193))

## [[2.0.1540](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1540-community)] - 2024-12-19

### Fixed

- Fix community `RoleChanged` event deserialization ([#7098](https://github.com/open-chat-labs/open-chat/pull/7098))

## [[2.0.1538](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1538-community)] - 2024-12-19

### Changed

- Log error if end video call job fails ([#7066](https://github.com/open-chat-labs/open-chat/pull/7066))
- 2-stage bot messages + bot context in messages ([#7060](https://github.com/open-chat-labs/open-chat/pull/7060))

### Removed

- Remove bot thread permissions ([#7071](https://github.com/open-chat-labs/open-chat/pull/7071))

### Fixed

- Fix `RoleChanged` events which were serialized under the wrong name (part 2) ([#7059](https://github.com/open-chat-labs/open-chat/pull/7059))
- Fix any long-running video calls that failed to be marked as ended ([#7068](https://github.com/open-chat-labs/open-chat/pull/7068))
- Avoid case where prize claims could result in "duplicate transfer" error ([#7079](https://github.com/open-chat-labs/open-chat/pull/7079))

## [[2.0.1515](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1515-community)] - 2024-12-13

### Added

- Update community bot config ([#7018](https://github.com/open-chat-labs/open-chat/pull/7018))

### Changed

- Return bots in community/group selected updates ([#7009](https://github.com/open-chat-labs/open-chat/pull/7009))
- Include the ledger canister Id in transfer failed error logs ([#7011](https://github.com/open-chat-labs/open-chat/pull/7011))
- Ensure bot has permission to execute given action ([#7014](https://github.com/open-chat-labs/open-chat/pull/7014))
- Allow bots to send a subset of message types ([#7016](https://github.com/open-chat-labs/open-chat/pull/7016))
- Switch to using `PrincipalToStableMemoryMap` ([#7023](https://github.com/open-chat-labs/open-chat/pull/7023))
- Reduce size by grouping member -> channel links per userId ([#7025](https://github.com/open-chat-labs/open-chat/pull/7025))
- Merge member Ids set with channel links map ([#7027](https://github.com/open-chat-labs/open-chat/pull/7027))
- Implement new lightweight search index for searching messages ([#7029](https://github.com/open-chat-labs/open-chat/pull/7029))
- Make `MessageId` comparisons use their 64bit representation ([#7030](https://github.com/open-chat-labs/open-chat/pull/7030))
- Record user who added bot to community/group ([#7035](https://github.com/open-chat-labs/open-chat/pull/7035))
- Bot message visibility tied to initiating user ([#7044](https://github.com/open-chat-labs/open-chat/pull/7044))

### Removed

- Remove code to migrate members and events to stable memory ([#7024](https://github.com/open-chat-labs/open-chat/pull/7024))

### Fixed

- Fix `RoleChanged` events which were serialized under the wrong name ([#7054](https://github.com/open-chat-labs/open-chat/pull/7054))

## [[2.0.1500](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1500-community)] - 2024-12-06

### Added

- Add/remove bot to/from community ([#6991](https://github.com/open-chat-labs/open-chat/pull/6991))

### Changed

- Remove chat members from being stored on the heap ([#6942](https://github.com/open-chat-labs/open-chat/pull/6942))
- Reduce the size of community events when serialized ([#6980](https://github.com/open-chat-labs/open-chat/pull/6980))
- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))
- Reduce size of the `UserCache` ([#6982](https://github.com/open-chat-labs/open-chat/pull/6982))
- Assign last updated timestamp to each updatable community attribute ([#6983](https://github.com/open-chat-labs/open-chat/pull/6983))
- Remove community members from being stored on the heap ([#6984](https://github.com/open-chat-labs/open-chat/pull/6984))
- Avoid iterating over community events ([#6986](https://github.com/open-chat-labs/open-chat/pull/6986))
- Make `summary` match `c2c_summary` so that `c2c_summary` can be removed ([#6988](https://github.com/open-chat-labs/open-chat/pull/6988))
- Remove `MemberJoined` and `MemberLeft` community events ([#6989](https://github.com/open-chat-labs/open-chat/pull/6989))
- Migrate community events to stable memory ([#6990](https://github.com/open-chat-labs/open-chat/pull/6990))

## [[2.0.1499](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1499-community)] - 2024-12-04

### Changed

- Remove UserId from member map values since it's already in the keys ([#6945](https://github.com/open-chat-labs/open-chat/pull/6945))
- Disallow sending prize messages to threads ([#6960](https://github.com/open-chat-labs/open-chat/pull/6960))
- Re-run member migration to stable memory using reduced size format ([#6965](https://github.com/open-chat-labs/open-chat/pull/6965))
- Introduce community `MembersMap` in prep for move to stable memory ([#6966](https://github.com/open-chat-labs/open-chat/pull/6966))
- Migrate community members to stable memory ([#6967](https://github.com/open-chat-labs/open-chat/pull/6967))
- Check bot + user permissions when issuing JWT ([#6970](https://github.com/open-chat-labs/open-chat/pull/6970))
- Reduce size of search index when serialized ([#6973](https://github.com/open-chat-labs/open-chat/pull/6973))
- Copy members from stable memory when importing group into community ([#6976](https://github.com/open-chat-labs/open-chat/pull/6976))
- Re-run member migration to stable member using reduced size format V2 ([#6977](https://github.com/open-chat-labs/open-chat/pull/6977))

### Removed

- Remove a load of unused candid endpoints ([#6947](https://github.com/open-chat-labs/open-chat/pull/6947))
- Remove references to bot_api_gateway ([#6944](https://github.com/open-chat-labs/open-chat/pull/6944))

### Fixed

- Don't supply a fee when BURNing ([#6948](https://github.com/open-chat-labs/open-chat/pull/6948))

## [[2.0.1486](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1486-community)] - 2024-12-02

### Changed

- Remove channel links from being stored on each community member ([#6923](https://github.com/open-chat-labs/open-chat/pull/6923))
- Remove entries from expiring members queue when channel deleted ([#6924](https://github.com/open-chat-labs/open-chat/pull/6924))
- Reduce size of chat members when serialized ([#6925](https://github.com/open-chat-labs/open-chat/pull/6925))
- Consolidate member verification logic into `get_verified_member` ([#6926](https://github.com/open-chat-labs/open-chat/pull/6926))
- Move members to `MembersMap` in prep for stable memory ([#6927](https://github.com/open-chat-labs/open-chat/pull/6927))
- Only handle a single bot action ([#6929](https://github.com/open-chat-labs/open-chat/pull/6929))
- Implement `MembersStableStorage` which stores members in stable memory ([#6931](https://github.com/open-chat-labs/open-chat/pull/6931))
- Migrate chat members to stable memory using timer job ([#6933](https://github.com/open-chat-labs/open-chat/pull/6933))
- Write group members to stable memory when importing group into community ([#6935](https://github.com/open-chat-labs/open-chat/pull/6935))
- Make `StableMemoryMap` use strongly typed keys ([#6937](https://github.com/open-chat-labs/open-chat/pull/6937))
- Read from stable memory members map once migration is complete ([#6938](https://github.com/open-chat-labs/open-chat/pull/6938))
- Restart member migration job after importing group into community ([#6940](https://github.com/open-chat-labs/open-chat/pull/6940))

## [[2.0.1479](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1479-community)] - 2024-11-28

### Changed

- Simplify how we store and query proposal votes ([#6906](https://github.com/open-chat-labs/open-chat/pull/6906))
- Remove member updates after 31 days ([#6907](https://github.com/open-chat-labs/open-chat/pull/6907))
- Extract member to channel links out of each member instance ([#6910](https://github.com/open-chat-labs/open-chat/pull/6910))
- Consolidate member updates into a single enum ([#6915](https://github.com/open-chat-labs/open-chat/pull/6915))
- Remove chat event updates after 31 days ([#6916](https://github.com/open-chat-labs/open-chat/pull/6916))

### Removed

- Remove code to deduplicate @everyone mentions ([#6901](https://github.com/open-chat-labs/open-chat/pull/6901))
- Remove code to migrate metrics to new reduced size format ([#6901](https://github.com/open-chat-labs/open-chat/pull/6901))
- Remove code to migrate community members to new reduced size format ([#6901](https://github.com/open-chat-labs/open-chat/pull/6901))
- Remove the old `gate` field which has been superseded by `gate_config` ([#6902](https://github.com/open-chat-labs/open-chat/pull/6902))

## [[2.0.1477](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1477-community)] - 2024-11-27

### Fixed

- Dedupe @everyone mentions using timer job ([#6899](https://github.com/open-chat-labs/open-chat/pull/6899))

## [[2.0.1475](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1475-community)] - 2024-11-26

### Added

- Add new prize message criteria ([#6831](https://github.com/open-chat-labs/open-chat/pull/6831))
- Accept calls from the BotApiGateway ([#6846](https://github.com/open-chat-labs/open-chat/pull/6846))

### Changed

- Store events in `HybridMap` which caches latest events on the heap ([#6762](https://github.com/open-chat-labs/open-chat/pull/6762))
- Reduce size of metrics in memory ([#6765](https://github.com/open-chat-labs/open-chat/pull/6765))
- Run cycles check (+ other background tasks) when executing timer jobs ([#6815](https://github.com/open-chat-labs/open-chat/pull/6815))
- Add cycles balance check to more timer jobs ([#6822](https://github.com/open-chat-labs/open-chat/pull/6822))
- Handle metric counters that overflow `u32::MAX` ([#6826](https://github.com/open-chat-labs/open-chat/pull/6826))
- Add the `BotCommand` access token type ([#6830](https://github.com/open-chat-labs/open-chat/pull/6830))
- Improve job to delete files after messages are deleted ([#6839](https://github.com/open-chat-labs/open-chat/pull/6839))
- Add `bot_api_gateway` canisterId to the canister state ([#6842](https://github.com/open-chat-labs/open-chat/pull/6842))
- Simplify `inspect_message` ([#6847](https://github.com/open-chat-labs/open-chat/pull/6847))
- Avoid double iteration when updating member expiry ([#6851](https://github.com/open-chat-labs/open-chat/pull/6851))
- Avoid cases where we were iterating over the full chat members map ([#6853](https://github.com/open-chat-labs/open-chat/pull/6853))
- Take a fee for prize messages and send to treasury ([#6854](https://github.com/open-chat-labs/open-chat/pull/6854))
- Store @everyone mentions once rather than linking to each user ([#6856](https://github.com/open-chat-labs/open-chat/pull/6856))
- Deduplicate existing @everyone mentions ([#6857](https://github.com/open-chat-labs/open-chat/pull/6857))
- Disallow promoting bots to owners ([#6865](https://github.com/open-chat-labs/open-chat/pull/6865))
- Reduce the number of events stored on the heap in the `HybridMap` ([#6867](https://github.com/open-chat-labs/open-chat/pull/6867))
- Return `FailedToDeserialize` and log error if unable to read event ([#6873](https://github.com/open-chat-labs/open-chat/pull/6873))
- Extract stable memory map so it can store additional datasets ([#6876](https://github.com/open-chat-labs/open-chat/pull/6876))
- Avoid iterating all channel members when determining who to notify of new message ([#6877](https://github.com/open-chat-labs/open-chat/pull/6877))
- Reduce size of community members when serialized ([#6883](https://github.com/open-chat-labs/open-chat/pull/6883))
- Avoid many cases where we were iterating over all community members ([#6884](https://github.com/open-chat-labs/open-chat/pull/6884))
- Make `ChannelId` comparisons use their 32bit representation ([#6885](https://github.com/open-chat-labs/open-chat/pull/6885))

### Removed

- Remove code to migrate events to stable memory now that it is complete ([#6769](https://github.com/open-chat-labs/open-chat/pull/6769))
- Remove code to migrate to the new thread summary format ([#6862](https://github.com/open-chat-labs/open-chat/pull/6862))
- Remove any spurious video calls in progress ([#6872](https://github.com/open-chat-labs/open-chat/pull/6872))

## [[2.0.1433](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1433-community)] - 2024-11-07

### Changed

- Restart migration job if threads need to be updated ([#6757](https://github.com/open-chat-labs/open-chat/pull/6757))
- Perform cycles check when migrating events to stable memory ([#6757](https://github.com/open-chat-labs/open-chat/pull/6757))

### Removed

- Remove events from being stored on the heap ([#6758](https://github.com/open-chat-labs/open-chat/pull/6758))

## [[2.0.1431](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1431-community)] - 2024-11-06

### Changed

- Consolidate `summary` and `c2c_summary` args ([#6723](https://github.com/open-chat-labs/open-chat/pull/6723))
- Fix case where some thread messages were not updated in stable memory ([#6736](https://github.com/open-chat-labs/open-chat/pull/6736))

### Fixed

- Fix migrating to stable memory for chats with disappearing messages ([#6746](https://github.com/open-chat-labs/open-chat/pull/6746))

## [[2.0.1423](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1423-community)] - 2024-11-05

### Changed

- Read events in batches when performing stable memory garbage collection ([#6682](https://github.com/open-chat-labs/open-chat/pull/6682))
- Improve efficiency of calculating latest threads per user ([#6687](https://github.com/open-chat-labs/open-chat/pull/6687))
- Avoid iterating over chat events to load mentions ([#6690](https://github.com/open-chat-labs/open-chat/pull/6690))
- Public channels of private communities unmuted by default ([#6708](https://github.com/open-chat-labs/open-chat/pull/6708))
- Read events from stable memory once migration is complete ([#6722](https://github.com/open-chat-labs/open-chat/pull/6722))

## [[2.0.1415](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1415-community)] - 2024-10-25

### Changed

- Avoid extra key lookup when iterating over events ([#6680](https://github.com/open-chat-labs/open-chat/pull/6680))

### Fixed

- Expose `import_group` over msgpack ([#6681](https://github.com/open-chat-labs/open-chat/pull/6681))

## [[2.0.1414](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1414-community)] - 2024-10-24

### Fixed

- Prevent `activity` when voting on your own poll ([#6675](https://github.com/open-chat-labs/open-chat/pull/6675))

## [[2.0.1409](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1409-community)] - 2024-10-24

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

- Refund P2P swap early if message is deleted ([#6626](https://github.com/open-chat-labs/open-chat/pull/6626))
- Fix removing link previews ([#6633](https://github.com/open-chat-labs/open-chat/pull/6633))
- Determine whether c2c call should be retried based on response error ([#6640](https://github.com/open-chat-labs/open-chat/pull/6640))
- Fix owners not receiving payments for composite payment gates ([#6652](https://github.com/open-chat-labs/open-chat/pull/6652))
- Don't send notifications to bots ([#6648](https://github.com/open-chat-labs/open-chat/pull/6648))
- Fix upgrade now that `Thread` message activity event has been deleted ([#6657](https://github.com/open-chat-labs/open-chat/pull/6657))

## [[2.0.1400](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1400-community)] - 2024-10-18

### Changed

- Only deserialize from old log state ([#6616](https://github.com/open-chat-labs/open-chat/pull/6616))

## [[2.0.1397](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1397-community)] - 2024-10-18

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Push activity to users using `GroupedTimerJobQueue` ([#6552](https://github.com/open-chat-labs/open-chat/pull/6552))
- Return `u128` rather than `Nat` for ICRC2 ledger errors ([#6597](https://github.com/open-chat-labs/open-chat/pull/6597))
- Lapsed members don't need to be re-invited ([#6602](https://github.com/open-chat-labs/open-chat/pull/6602))
- Community summary updated if details updated ([#6606](https://github.com/open-chat-labs/open-chat/pull/6606))

## [[2.0.1391](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1391-community)] - 2024-10-15

### Changed

- Reduce size of some message types when serialized ([#6559](https://github.com/open-chat-labs/open-chat/pull/6559))
- Log details whenever a prize claim results in a ledger error ([#6560](https://github.com/open-chat-labs/open-chat/pull/6560))
- Ensure members marked as lapsed in updates queries ([#6573](https://github.com/open-chat-labs/open-chat/pull/6573))
- Reduce size of responses by only returning UserIds for basic members ([#6577](https://github.com/open-chat-labs/open-chat/pull/6577))
- Remove `transaction` from serialized PrizeWinner messages ([#6578](https://github.com/open-chat-labs/open-chat/pull/6578))
- Handle display name changes more efficiently ([#6585](https://github.com/open-chat-labs/open-chat/pull/6585))

## [[2.0.1378](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1378-community)] - 2024-10-10

### Fixed

- Fix video calls in communities ([#6554](https://github.com/open-chat-labs/open-chat/pull/6554))

## [[2.0.1377](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1377-community)] - 2024-10-10

### Added

- Add support for expiring access gates ([#6401](https://github.com/open-chat-labs/open-chat/pull/6401))

### Changed

- Mark prize messages as having ledger error if transfers fail ([#6500](https://github.com/open-chat-labs/open-chat/pull/6500))
- Make adding existing users to a new channel more efficient ([#6504](https://github.com/open-chat-labs/open-chat/pull/6504))
- Further refactoring of adding multiple users to public channels ([#6506](https://github.com/open-chat-labs/open-chat/pull/6506))
- Populate search index for Windoge98 community which failed previous upgrade ([#6549](https://github.com/open-chat-labs/open-chat/pull/6549))

## [[2.0.1365](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1365-community)] - 2024-10-02

### Added

- Add MessagePack versions of all endpoints ([#6463](https://github.com/open-chat-labs/open-chat/pull/6463))
- Add `lookup_members` endpoint ([#6472](https://github.com/open-chat-labs/open-chat/pull/6472))

### Changed

- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Simplify prize winner messages to reduce size (part 1) ([#6449](https://github.com/open-chat-labs/open-chat/pull/6449))
- Generate new channel Ids as 32bit rather than 128bit ([#6464](https://github.com/open-chat-labs/open-chat/pull/6464))
- Simplify search logic and move it into `SearchIndex` struct ([#6465](https://github.com/open-chat-labs/open-chat/pull/6465))
- Return owned values from `EventsMap` in prep for switch to stable memory ([#6469](https://github.com/open-chat-labs/open-chat/pull/6469))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))

### Removed

- Remove `selected_updates` now that everything uses the v2 version ([#6461](https://github.com/open-chat-labs/open-chat/pull/6461))

### Fixed

- Avoid pushing community event if no users invited ([#6477](https://github.com/open-chat-labs/open-chat/pull/6477))

## [[2.0.1351](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1351-community)] - 2024-09-20

### Changed

- Update `send_message` args to work with MessagePack ([#6425](https://github.com/open-chat-labs/open-chat/pull/6315))
- Add `winner_count` to prizes enabling us to stop sending all winners ([#6426](https://github.com/open-chat-labs/open-chat/pull/6426))

### Fixed

- Refund prize messages that are removed due to disappearing messages ([#6427](https://github.com/open-chat-labs/open-chat/pull/6427))

## [[2.0.1349](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1349-community)] - 2024-09-16

### Added

- Add `ReferredByMember` access gate ([#6377](https://github.com/open-chat-labs/open-chat/pull/6377))

### Changed

- Disallow sending messages to chats that have an external url set ([#6369](https://github.com/open-chat-labs/open-chat/pull/6369))
- Change `cancel_invites` to mark community active ([#6390](https://github.com/open-chat-labs/open-chat/pull/6390))

## [[2.0.1337](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1337-community)] - 2024-09-10

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Support community referrals ([#6317](https://github.com/open-chat-labs/open-chat/pull/6317))
- Don't allow a user to refer themselves ([#6322](https://github.com/open-chat-labs/open-chat/pull/6322))
- Improve query caching by avoiding calls to `ic0::caller()` where possible ([#6332](https://github.com/open-chat-labs/open-chat/pull/6332))

### Fixed

- Ensure invited users can't contain duplicates ([#6333](https://github.com/open-chat-labs/open-chat/pull/6333))

## [[2.0.1308](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1308-community)] - 2024-08-26

### Fixed

- Mark ProposalsBot as an OC controlled bot ([#6285](https://github.com/open-chat-labs/open-chat/pull/6285))

## [[2.0.1296](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1296-community)] - 2024-08-16

### Changed

- Support next batch of achievements ([#6230](https://github.com/open-chat-labs/open-chat/pull/6230))
- Remove references to deleted users ([#6241](https://github.com/open-chat-labs/open-chat/pull/6241))
- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1287](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1287-community)] - 2024-08-13

### Added

- Add `external_url` property to channel ([#6226](https://github.com/open-chat-labs/open-chat/pull/6226))

## [[2.0.1286](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1286-community)] - 2024-08-12

### Added

- Support updating add members permission ([#6194](https://github.com/open-chat-labs/open-chat/pull/6194))

### Changed

- Members of private communities can be added to channels skipping gate checks ([#6159](https://github.com/open-chat-labs/open-chat/pull/6159))

## [[2.0.1272](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1272-community)] - 2024-07-31

### Changed

- Change max channel name length from 25 to 40 chars ([#6138](https://github.com/open-chat-labs/open-chat/pull/6138))
- Configure message visibility to non-members of public channels ([#6152](https://github.com/open-chat-labs/open-chat/pull/6152))

## [[2.0.1261](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1261-community)] - 2024-07-26

### Added

- Add `Locked` gate ([#6095](https://github.com/open-chat-labs/open-chat/pull/6095))

### Changed

- Fix fee then retry transfer if fee too high ([#6063](https://github.com/open-chat-labs/open-chat/pull/6063))
- Handle transfer fee changing in either direction ([#6064](https://github.com/open-chat-labs/open-chat/pull/6064))
- Bypass gates if user is invited ([#6110](https://github.com/open-chat-labs/open-chat/pull/6110))
- Return `is_invited` when previewing community/channel ([#6113](https://github.com/open-chat-labs/open-chat/pull/6113))
- Use `UserType` rather than `is_bot` and `is_oc_controlled_bot` ([#6116](https://github.com/open-chat-labs/open-chat/pull/6116))
- Allow OC controlled bots to send crypto transfer messages ([#6117](https://github.com/open-chat-labs/open-chat/pull/6117))

### Fixed

- Avoid getting stuck in infinite loop trying to refund prizes ([#6080](https://github.com/open-chat-labs/open-chat/pull/6080))

## [[2.0.1244](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1244-community)] - 2024-07-18

### Added

- Support gates with multiple verifiable credentials ([#6029](https://github.com/open-chat-labs/open-chat/pull/6029))
- Allow UserIndex to send Group/Channel messages as the OpenChat Bot ([#6048](https://github.com/open-chat-labs/open-chat/pull/6048))

### Changed

- Added support for a bunch more achievements ([#6033](https://github.com/open-chat-labs/open-chat/pull/6033))

## [[2.0.1235](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1235-community)] - 2024-07-09

### Added

- Add `LifetimeDiamondMembership` access gate ([#5986](https://github.com/open-chat-labs/open-chat/pull/5986))
- Add `UniquePerson` access gate ([#5993](https://github.com/open-chat-labs/open-chat/pull/5993))
- Support composite access gates ([#5988](https://github.com/open-chat-labs/open-chat/pull/5988))

### Fixed

- Allow changing casing of channel names ([#5999](https://github.com/open-chat-labs/open-chat/pull/5999))

## [[2.0.1194](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1194-community)] - 2024-06-06

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

## [[2.0.1170](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1170-community)] - 2024-05-13

### Changed

- Support prize messages with 128bit prize amounts ([#5729](https://github.com/open-chat-labs/open-chat/pull/5729))
- Don't retry c2c calls after getting a `DestinationInvalid` error ([#5732](https://github.com/open-chat-labs/open-chat/pull/5732))
- Expose count of timer jobs in metrics ([#5744](https://github.com/open-chat-labs/open-chat/pull/5744))
- Don't retry c2c calls after getting a `CanisterMethodNotFound` error ([#5747](https://github.com/open-chat-labs/open-chat/pull/5747))

## [[2.0.1152](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1152-community)] - 2024-04-23

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
- Support blocking users who are no longer in the community ([#5719](https://github.com/open-chat-labs/open-chat/pull/5719))

### Fixed

- Fix payments which are failing due to being too old ([#5681](https://github.com/open-chat-labs/open-chat/pull/5681))
- One time job to mark video calls ended if message deleted ([#5714](https://github.com/open-chat-labs/open-chat/pull/5714))

## [[2.0.1139](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1139-community)] - 2024-04-10

### Changed

- Update `event_store` packages to latest version ([#5593](https://github.com/open-chat-labs/open-chat/pull/5593))
- Disallow deleting video call message if the call is still in progress ([#5607](https://github.com/open-chat-labs/open-chat/pull/5607))
- Refactor `c2c_can_issue_access_token_for_channel` ([#5613](https://github.com/open-chat-labs/open-chat/pull/5613))
- Add `call_type` to `VideoCall` ([#5661](https://github.com/open-chat-labs/open-chat/pull/5661))
- Include `call_type` in request to get video call access token ([#5662](https://github.com/open-chat-labs/open-chat/pull/5662))

### Fixed

- One time job to mark video calls ended if message deleted ([#5612](https://github.com/open-chat-labs/open-chat/pull/5612))
- Fix DKP transfers which have the old fee ([#5614](https://github.com/open-chat-labs/open-chat/pull/5614))

## [[2.0.1118](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1118-community)] - 2024-03-21

### Fixed

- Add missing mappings for ICL and ELNA ([#5580](https://github.com/open-chat-labs/open-chat/pull/5580))
- Add missing mapping for the old SNEED token ([#5581](https://github.com/open-chat-labs/open-chat/pull/5581))

## [[2.0.1115](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1115-community)] - 2024-03-20

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
- Anonymize all Community canisters in events ([#5568](https://github.com/open-chat-labs/open-chat/pull/5568))
- Fallback job to mark video calls as ended ([#5569](https://github.com/open-chat-labs/open-chat/pull/5569))

### Fixed

- Mark old video calls as having ended ([#5572](https://github.com/open-chat-labs/open-chat/pull/5572))

## [[2.0.1094](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1094-community)] - 2024-03-08

### Added

- Implement ability to push events from Community canisters ([#5436](https://github.com/open-chat-labs/open-chat/pull/5436))
- Push event each time a message is sent ([#5439](https://github.com/open-chat-labs/open-chat/pull/5439))
- Push backdated message events ([#5441](https://github.com/open-chat-labs/open-chat/pull/5441))
- Add 'start_video_call' endpoint ([#5470](https://github.com/open-chat-labs/open-chat/pull/5470))

### Changed

- Use ICRC1 for ICP transactions between users ([#5426](https://github.com/open-chat-labs/open-chat/pull/5426))
- Add more details to message event payloads ([#5447](https://github.com/open-chat-labs/open-chat/pull/5447))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Don't send video call notification to user who started the call ([#5462](https://github.com/open-chat-labs/open-chat/pull/5462))
- Use initiator as sender for video calls rather than VideoCallBot ([#5477](https://github.com/open-chat-labs/open-chat/pull/5477))
- Set `anonymized_id` on each channel in `post_upgrade` ([#5478](https://github.com/open-chat-labs/open-chat/pull/5478))
- Simplify `start_video_call` responses ([#5479](https://github.com/open-chat-labs/open-chat/pull/5479))
- Join video calls by `message_id` rather than `message_index` ([#5482](https://github.com/open-chat-labs/open-chat/pull/5482))
- Unblock users from channels and block from community instead ([#5483](https://github.com/open-chat-labs/open-chat/pull/5483))
- Add `start_video_call` permission ([#5488](https://github.com/open-chat-labs/open-chat/pull/5488))
- Push message events from within `chat_events` ([#5494](https://github.com/open-chat-labs/open-chat/pull/5494))

### Fixed

- Update group index when community gate changes ([#5463](https://github.com/open-chat-labs/open-chat/pull/5463))

## [[2.0.1075](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1075-community)] - 2024-02-22

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))
- VideoCall message + permission + summary/updates ([#5357](https://github.com/open-chat-labs/open-chat/pull/5357))
- Endpoints to join and end video calls ([#5374](https://github.com/open-chat-labs/open-chat/pull/5374))
- Add `c2c_can_access_channel` endpoint ([#5398](https://github.com/open-chat-labs/open-chat/pull/5398))

### Changed

- Hack to cater for SNEED's unique handling of transfer fees ([#5280](https://github.com/open-chat-labs/open-chat/pull/5280))
- Add `minimum_yes_proportion_of_total` to SNS proposals ([#5284](https://github.com/open-chat-labs/open-chat/pull/5284))
- Allow video call operator to send to all communities ([#5390](https://github.com/open-chat-labs/open-chat/pull/5390))
- End video call by `MessageId` ([#5401](https://github.com/open-chat-labs/open-chat/pull/5401))

### Fixed

- Add randomness to default channel Ids ([#5405](https://github.com/open-chat-labs/open-chat/pull/5405))

## [[2.0.1021](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1021-community)] - 2024-01-24

### Changed

- Simplify timer jobs + make them more efficient ([#5233](https://github.com/open-chat-labs/open-chat/pull/5233))
- Avoid sending prize winner notifications ([#5236](https://github.com/open-chat-labs/open-chat/pull/5236))
- Add timer job to mark P2P swaps as expired ([#5246](https://github.com/open-chat-labs/open-chat/pull/5246))

### Fixed

- Fix p2p swaps in threads which weren't being marked as updated ([#5235](https://github.com/open-chat-labs/open-chat/pull/5235))

## [[2.0.1015](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1015-community)] - 2024-01-19

### Added

- Show proposal payloads for NNS proposals ([#5072](https://github.com/open-chat-labs/open-chat/pull/5072))
- Add TokenBalance access gate ([#5120](https://github.com/open-chat-labs/open-chat/pull/5120))
- Expose details of timer jobs for public Communities ([#5154](https://github.com/open-chat-labs/open-chat/pull/5154))
- Notify community when p2p swap status changes ([#5201](https://github.com/open-chat-labs/open-chat/pull/5201))
- Implement `cancel_p2p_swap` for communities ([#5204](https://github.com/open-chat-labs/open-chat/pull/5204))

### Changed

- Add `subtype` to channel search results ([#5084](https://github.com/open-chat-labs/open-chat/pull/5084))
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

## [[2.0.985](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.985-community)] - 2023-12-19

### Added

- Support getting batches of summary updates via LocalUserIndex ([#4983](https://github.com/open-chat-labs/open-chat/pull/4983))
- Add support for P2P trades ([#4897](https://github.com/open-chat-labs/open-chat/pull/4897))
- One time job to add members to Diamond member gated channels ([#5037](https://github.com/open-chat-labs/open-chat/pull/5037))

### Changed

- Reduce cut of payment gate fee for SNS from 20% -> 2% ([#4991](https://github.com/open-chat-labs/open-chat/pull/4991))
- Suppress notifications and @s for suspect messages ([#5006](https://github.com/open-chat-labs/open-chat/pull/5006))
- Make Diamond membership gate check synchronous ([#5027](https://github.com/open-chat-labs/open-chat/pull/5027))
- Auto join Diamond members to newly created Diamond gated channels ([#5028](https://github.com/open-chat-labs/open-chat/pull/5028))
- Join community members to public channel if it has its gate removed ([#5033](https://github.com/open-chat-labs/open-chat/pull/5033))

### Fixed

- Fix for NNS proposal deadlines not being updated ([#4978](https://github.com/open-chat-labs/open-chat/pull/4978))
- Fix incorrect `local_user_index_canister_id` values ([#5009](https://github.com/open-chat-labs/open-chat/pull/5009))

## [[2.0.965](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.965-community)] - 2023-12-07

### Fixed

- Fix bug which allowed anyone to mention @everyone ([#4930](https://github.com/open-chat-labs/open-chat/pull/4930))

## [[2.0.958](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.958-community)] - 2023-12-05

### Added

- Add `c2c_send_message` with improved API for c2c calls vs `send_message` ([#4895](https://github.com/open-chat-labs/open-chat/pull/4895))

### Changed

- Burn any CHAT going to the treasury ([#4891](https://github.com/open-chat-labs/open-chat/pull/4891))
- Move prize winner messages to be in a thread on each prize message ([#4915](https://github.com/open-chat-labs/open-chat/pull/4915))

## [[2.0.949](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.949-community)] - 2023-11-28

### Added

- Support getting batches of chat events via LocalUserIndex ([#4848](https://github.com/open-chat-labs/open-chat/pull/4848))

### Changed

- Make events private for payment gated chats ([#4843](https://github.com/open-chat-labs/open-chat/pull/4843))
- In modclub reports only show public message links ([#4847](https://github.com/open-chat-labs/open-chat/pull/4847))
- Add `local_user_index_canister_id` to community summaries ([#4857](https://github.com/open-chat-labs/open-chat/pull/4857))

## [[2.0.945](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.945-community)] - 2023-11-24

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
