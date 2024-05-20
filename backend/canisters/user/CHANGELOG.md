# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Maintain log of CHIT events + query ([#5817](https://github.com/open-chat-labs/open-chat/pull/5817))

### Changed

- Default video call max duration to 1 hour ([#5824](https://github.com/open-chat-labs/open-chat/pull/5824))

### Removed

- Remove code to update user principals ([#5808](https://github.com/open-chat-labs/open-chat/pull/5808))

## [[2.0.1172](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1172-user)] - 2024-05-13

### Changed

- Support prize messages with 128bit prize amounts ([#5729](https://github.com/open-chat-labs/open-chat/pull/5729))
- Don't retry c2c calls after getting a `DestinationInvalid` error ([#5732](https://github.com/open-chat-labs/open-chat/pull/5732))
- Expose count of timer jobs in metrics ([#5744](https://github.com/open-chat-labs/open-chat/pull/5744))
- Don't retry c2c calls after getting a `CanisterMethodNotFound` error ([#5747](https://github.com/open-chat-labs/open-chat/pull/5747))

### Fixed

- Remove dangling references to deleted chats ([#5774](https://github.com/open-chat-labs/open-chat/pull/5774))
- Add missing pin check to c2c_accept_p2p_swap ([#5777](https://github.com/open-chat-labs/open-chat/pull/5777))

## [[2.0.1154](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1154-user)] - 2024-04-23

### Added

- Mark which user accounts are more than 6 month old and have no chats ([#5696](https://github.com/open-chat-labs/open-chat/pull/5696))

### Changed

- Add `block_level_markdown` flag to messages ([#5680](https://github.com/open-chat-labs/open-chat/pull/5680))
- Store presence kind of each video call participant ([#5682](https://github.com/open-chat-labs/open-chat/pull/5682))
- Add `block_level_markdown` to edit message args ([#5697](https://github.com/open-chat-labs/open-chat/pull/5697))
- Allow non-Diamond members to start video calls ([#5706](https://github.com/open-chat-labs/open-chat/pull/5706))
- Update `event_store` packages to v0.1.0 ([#5715](https://github.com/open-chat-labs/open-chat/pull/5715))
- Include both heap and stable memory in cycles balance check ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

### Fixed

- One time job to mark video calls ended if message deleted ([#5714](https://github.com/open-chat-labs/open-chat/pull/5714))

## [[2.0.1141](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1141-user)] - 2024-04-11

### Added

- Add ability to deposit and withdraw BTC directly in your OC wallet ([#5617](https://github.com/open-chat-labs/open-chat/pull/5617))

### Changed

- Update `event_store` packages to latest version ([#5593](https://github.com/open-chat-labs/open-chat/pull/5593))
- Disallow deleting video call message if the call is still in progress ([#5607](https://github.com/open-chat-labs/open-chat/pull/5607))
- Refactor `c2c_can_issue_access_token` ([#5613](https://github.com/open-chat-labs/open-chat/pull/5613))
- Add `call_type` to `VideoCall` ([#5661](https://github.com/open-chat-labs/open-chat/pull/5661))
- Include `call_type` in request to get video call access token ([#5662](https://github.com/open-chat-labs/open-chat/pull/5662))
- Ensure we don't attempt to call c2c into the OpenChat bot ([#5665](https://github.com/open-chat-labs/open-chat/pull/5665))

### Fixed

- One time job to mark video calls ended if message deleted ([#5612](https://github.com/open-chat-labs/open-chat/pull/5612))

## [[2.0.1120](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1120-user)] - 2024-03-21

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

- Update `event_store` packages to latest version ([#5535](https://github.com/open-chat-labs/open-chat/pull/5535))
- Initial groundwork to support threads in direct chats ([#5552](https://github.com/open-chat-labs/open-chat/pull/5552))
- Further groundwork to support threads in direct chats ([#5567](https://github.com/open-chat-labs/open-chat/pull/5567))
- Anonymize all User canisters in events ([#5568](https://github.com/open-chat-labs/open-chat/pull/5568))
- Fallback job to mark video calls as ended ([#5569](https://github.com/open-chat-labs/open-chat/pull/5569))
- Simplify `pin_number_settings` ([#5577](https://github.com/open-chat-labs/open-chat/pull/5577))

### Fixed

- Retry failed DKP swaps with correct transaction fee ([#5542](https://github.com/open-chat-labs/open-chat/pull/5542))
- Mark old video calls as having ended ([#5572](https://github.com/open-chat-labs/open-chat/pull/5572))
- Add missing mappings for ICL and ELNA ([#5580](https://github.com/open-chat-labs/open-chat/pull/5580))
- Add missing mapping for the old SNEED token ([#5581](https://github.com/open-chat-labs/open-chat/pull/5581))

## [[2.0.1100](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1100-user)] - 2024-03-11

### Added

- Implement ability to push events from User canisters ([#5436](https://github.com/open-chat-labs/open-chat/pull/5436))
- Push event each time a message is sent ([#5439](https://github.com/open-chat-labs/open-chat/pull/5439))
- Push backdated message events ([#5441](https://github.com/open-chat-labs/open-chat/pull/5441))
- Add 'start_video_call' endpoint ([#5470](https://github.com/open-chat-labs/open-chat/pull/5470))

### Changed

- Use ICRC1 for ICP transactions between users ([#5426](https://github.com/open-chat-labs/open-chat/pull/5426))
- Add more details to message event payloads ([#5447](https://github.com/open-chat-labs/open-chat/pull/5447))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Support populating usernames in OpenChat Bot messages ([#5476](https://github.com/open-chat-labs/open-chat/pull/5476))
- Use initiator as sender for video calls rather than VideoCallBot ([#5477](https://github.com/open-chat-labs/open-chat/pull/5477))
- Simplify `start_video_call` responses ([#5479](https://github.com/open-chat-labs/open-chat/pull/5479))
- Join video calls by `message_id` rather than `message_index` ([#5482](https://github.com/open-chat-labs/open-chat/pull/5482))
- Add `start_video_call` permission  ([#5488](https://github.com/open-chat-labs/open-chat/pull/5488))
- Push message events from within `chat_events` ([#5494](https://github.com/open-chat-labs/open-chat/pull/5494))

### Removed

- Remove c2c endpoints that are now handled via events ([#5437](https://github.com/open-chat-labs/open-chat/pull/5437))

## [[2.0.1078](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1078-user)] - 2024-02-22

### Added

- Add `local_user_index` endpoint ([#5413](https://github.com/open-chat-labs/open-chat/pull/5413))
- Add `c2c_can_issue_access_token` endpoint ([#5415](https://github.com/open-chat-labs/open-chat/pull/5415))

### Changed

- Hack to cater for SNEED's unique handling of transfer fees ([#5280](https://github.com/open-chat-labs/open-chat/pull/5280))
- Add `minimum_yes_proportion_of_total` to SNS proposals ([#5284](https://github.com/open-chat-labs/open-chat/pull/5284))
- VideoCall message + permission + summary/updates ([#5357](https://github.com/open-chat-labs/open-chat/pull/5357))
- Endpoints to join and end video calls ([#5374](https://github.com/open-chat-labs/open-chat/pull/5374))
- End video call by `MessageId` ([#5401](https://github.com/open-chat-labs/open-chat/pull/5401))

## [[2.0.1032](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1032-user)] - 2024-01-25

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))

### Changed

- Use message queue to send events between user canisters ([#5234](https://github.com/open-chat-labs/open-chat/pull/5234))
- Avoid setting up canister timer unless job already in progress ([#5243](https://github.com/open-chat-labs/open-chat/pull/5243))
- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))

### Fixed

- Fix input amount display in p2p swaps ([#5223](https://github.com/open-chat-labs/open-chat/pull/5223))
- Fix syncing of P2P swap status updates between user canisters ([#5230](https://github.com/open-chat-labs/open-chat/pull/5230))

## [[2.0.1013](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1013-user)] - 2024-01-18

### Added

- Add TokenBalance access gate ([#5120](https://github.com/open-chat-labs/open-chat/pull/5120))
- Implement p2p trades in direct chats ([#5168](https://github.com/open-chat-labs/open-chat/pull/5168))
- Add message queues for pushing updates between user canisters ([#5172](https://github.com/open-chat-labs/open-chat/pull/5172))
- Push p2p swap status changes between user canisters ([#5187](https://github.com/open-chat-labs/open-chat/pull/5187))
- Notify user canisters when p2p swaps complete ([#5191](https://github.com/open-chat-labs/open-chat/pull/5191))
- Cancel p2p swap if message is deleted ([#5192](https://github.com/open-chat-labs/open-chat/pull/5192))
- Add timer job to set p2p swap status to `Expired` ([#5195](https://github.com/open-chat-labs/open-chat/pull/5195))
- Implement `cancel_p2p_swap` ([#5197](https://github.com/open-chat-labs/open-chat/pull/5197))

### Changed

- Add `local_user_index_canister_id` to `initial_state` response ([#5083](https://github.com/open-chat-labs/open-chat/pull/5083))
- Don't mark messages as edited if only link removed ([#5119](https://github.com/open-chat-labs/open-chat/pull/5119))
- Increase max message length to 10k characters ([#5140](https://github.com/open-chat-labs/open-chat/pull/5140))
- Return success from `deleted_message` even if message not deleted ([#5145](https://github.com/open-chat-labs/open-chat/pull/5145))
- Change `expires_at` to `expires_in` for p2p trade initial ([#5147](https://github.com/open-chat-labs/open-chat/pull/5147))
- Ensure swap responses contain all transaction ids ([#5174](https://github.com/open-chat-labs/open-chat/pull/5174))
- Use "swap" instead of "trade" in vars and types ([#5175](https://github.com/open-chat-labs/open-chat/pull/5175))
- Only use transaction index for p2p swaps and drop usage of hash ([#5203](https://github.com/open-chat-labs/open-chat/pull/5203))
- Set group/community canister as an additional admin on p2p swaps ([#5204](https://github.com/open-chat-labs/open-chat/pull/5204))
- Validate against duplicate messageId before making transfer ([#5212](https://github.com/open-chat-labs/open-chat/pull/5212))

### Removed

- Remove group summary cache ([#5067](https://github.com/open-chat-labs/open-chat/pull/5067))

### Fixed

- Fix bug where `cancel_job` would fail to find the job to cancel ([#5148](https://github.com/open-chat-labs/open-chat/pull/5148))
- Retry failed Windoge98 withdrawals using correct fee ([#5177](https://github.com/open-chat-labs/open-chat/pull/5177))

## [[2.0.989](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.989-user)] - 2023-12-20

### Added

- Add support for P2P trades ([#4897](https://github.com/open-chat-labs/open-chat/pull/4897))

### Changed

- Log error if any steps during a swap fail ([#4972](https://github.com/open-chat-labs/open-chat/pull/4972))
- Expose logs of swaps ([#4980](https://github.com/open-chat-labs/open-chat/pull/4980))
- Suppress notifications and @s for suspect messages ([#5006](https://github.com/open-chat-labs/open-chat/pull/5006))
- Retry sending messages with crypto transfers to groups & channels ([#5051](https://github.com/open-chat-labs/open-chat/pull/5051))
- Switch over to using `c2c_send_message_v2` ([#5054](https://github.com/open-chat-labs/open-chat/pull/5054))

### Fixed

- Fix incorrect `local_user_index_canister_id` values ([#5009](https://github.com/open-chat-labs/open-chat/pull/5009))

## [[2.0.963](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.963-user)] - 2023-12-05

### Changed

- When swapping tokens take fee out of amount passed in ([#4934](https://github.com/open-chat-labs/open-chat/pull/4934))

### Fixed

- A few fixes for swapping tokens ([#4937](https://github.com/open-chat-labs/open-chat/pull/4937))

## [[2.0.961](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.961-user)] - 2023-12-05

### Added

- Support getting batches of chat events via LocalUserIndex ([#4848](https://github.com/open-chat-labs/open-chat/pull/4848))
- Add `c2c_send_messages_v2` which uses MessageContentInternal ([#4902](https://github.com/open-chat-labs/open-chat/pull/4902))

### Changed

- In modclub reports only show public message links ([#4847](https://github.com/open-chat-labs/open-chat/pull/4847))
- Add `local_user_index_canister_id` to group/community summaries ([#4857](https://github.com/open-chat-labs/open-chat/pull/4857))
- Switch to `c2c_send_message` when sending messages c2c to groups or channels ([#4895](https://github.com/open-chat-labs/open-chat/pull/4895))
- Remove `display_name` from `init` args ([#4910](https://github.com/open-chat-labs/open-chat/pull/4910))
- Handle case where swap fails due to slippage ([#4924](https://github.com/open-chat-labs/open-chat/pull/4924))

## [[2.0.947](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.947-user)] - 2023-11-24

### Added

- Support paying in CHAT for Diamond membership ([#4748](https://github.com/open-chat-labs/open-chat/pull/4748))
- Add `approve_transfer` endpoint ([#4767](https://github.com/open-chat-labs/open-chat/pull/4767))
- Support deleting direct chats (only for the current user) ([#4816](https://github.com/open-chat-labs/open-chat/pull/4816))
- Implement swapping of tokens via external DEXs ([#4819](https://github.com/open-chat-labs/open-chat/pull/4819))

### Changed

- `c2c_set_user_suspended` also returns user's communities ([#4749](https://github.com/open-chat-labs/open-chat/pull/4749))
- Return `suspended` in `initial_state` and `updates` ([#4750](https://github.com/open-chat-labs/open-chat/pull/4750))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Use current timestamp in 'replica up to date' check ([#4763](https://github.com/open-chat-labs/open-chat/pull/4763))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Pass up number of decimals when tipping to fix notification text ([#4796](https://github.com/open-chat-labs/open-chat/pull/4796))
- Change `ApproveTransferArgs` to take `expires_in` ([#4810](https://github.com/open-chat-labs/open-chat/pull/4810))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Add crypto payment access gate ([#4823](https://github.com/open-chat-labs/open-chat/pull/4823))

### Removed

- Remove `latest_client_event_index` from args to get events ([#4747](https://github.com/open-chat-labs/open-chat/pull/4747))

## [[2.0.932](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.932-user)] - 2023-11-09

### Changed

- Add `events_ttl_last_updated` to chat summaries ([#4711](https://github.com/open-chat-labs/open-chat/pull/4711))
- Extend `c2c_report_message` endpoint ([#4719](https://github.com/open-chat-labs/open-chat/pull/4719))
- Don't collect reason or notes from reporter ([#4724](https://github.com/open-chat-labs/open-chat/pull/4724))
- Improve `ReplicaNotUpToDate` check to avoid displaying outdated events ([#4727](https://github.com/open-chat-labs/open-chat/pull/4727))

## [[2.0.923](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.923-user)] - 2023-11-03

### Added

- Support submitting proposals of type `UpgradeSnsToNextVersion` ([#4670](https://github.com/open-chat-labs/open-chat/pull/4670))
- Support submitting proposals of type `UpgradeSnsControlledCanister` ([#4672](https://github.com/open-chat-labs/open-chat/pull/4672))
- Add `report_message` endpoint ([#4691](https://github.com/open-chat-labs/open-chat/pull/4691))
- Support submitting proposals of type `ExecuteGenericNervousSystemFunction` ([#4694](https://github.com/open-chat-labs/open-chat/pull/4694))

### Changed

- Reduce size of message content when serialized ([#4680](https://github.com/open-chat-labs/open-chat/pull/4680))
- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Make `events_map` generic in preparation for moving it to stable memory ([#4689](https://github.com/open-chat-labs/open-chat/pull/4689))
- Add `latest_message_index` to chat summaries ([#4693](https://github.com/open-chat-labs/open-chat/pull/4693))
- Allow deleting all message types ([#4697](https://github.com/open-chat-labs/open-chat/pull/4697))

## [[2.0.912](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.912-user)] - 2023-10-27

### Added

- Add `permissions_v2` to cached `GroupChatSummary` and `create_group` ([#4620](https://github.com/open-chat-labs/open-chat/pull/4620))

### Changed

- Don't set expiry on `EventsTimeToLiveUpdated` events ([#4616](https://github.com/open-chat-labs/open-chat/pull/4616))
- Avoid setting expiry for some event types ([#4647](https://github.com/open-chat-labs/open-chat/pull/4647))
- Return expired event + message ranges when getting events ([#4646](https://github.com/open-chat-labs/open-chat/pull/4646))

## [[2.0.890](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.890-user)] - 2023-10-19

### Fixed

- Add `serde(default)` attribute to fix a few failed upgrades ([#4610](https://github.com/open-chat-labs/open-chat/pull/4610))

## [[2.0.887](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.887-user)] - 2023-10-17

### Added

- Support submitting proposals to any governance canister ([#4579](https://github.com/open-chat-labs/open-chat/pull/4579))
- Support sending ICP to ICRC1 accounts ([#4583](https://github.com/open-chat-labs/open-chat/pull/4583))
- Add optional `diamond_only` filter to prize messages ([#4587](https://github.com/open-chat-labs/open-chat/pull/4587))

### Changed

- Switch user canisters over to using `MemoryManager` ([#4600](https://github.com/open-chat-labs/open-chat/pull/4600))
- Set memo based on transaction type ([#4603](https://github.com/open-chat-labs/open-chat/pull/4603))

### Removed

- Removed calls to `c2c_toggle_mute_notifications` ([#4513](https://github.com/open-chat-labs/open-chat/pull/4513))

## [[2.0.871](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.871-user)] - 2023-10-05

### Added

- Support submitting proposals from within OpenChat ([#4486](https://github.com/open-chat-labs/open-chat/pull/4486))

### Changed

- Notifications for custom messages should use the sub-type ([#4465](https://github.com/open-chat-labs/open-chat/pull/4465))
- Support prize messages in any token by getting fee from original transfer ([#4470](https://github.com/open-chat-labs/open-chat/pull/4470))
- Prevent transfers to yourself ([#4471](https://github.com/open-chat-labs/open-chat/pull/4471))
- Retry sending tip if c2c call fails ([#4482](https://github.com/open-chat-labs/open-chat/pull/4482))
- Store `proposals_bot_canister_id` in user canisters ([#4485](https://github.com/open-chat-labs/open-chat/pull/4485))
- Switch crypto messages to only contain completed transactions ([#4489](https://github.com/open-chat-labs/open-chat/pull/4489))

## [[2.0.867](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.867-user)] - 2023-09-27

### Added

- Add `mention_all_members` group permission ([#4405](https://github.com/open-chat-labs/open-chat/pull/4405))
- Implement tipping messages ([#4420](https://github.com/open-chat-labs/open-chat/pull/4420))
- Implement notifications for message tips ([#4427](https://github.com/open-chat-labs/open-chat/pull/4427))
- Add `followed_by_me` to the thread summary returned in GroupChatSummary ([#4431](https://github.com/open-chat-labs/open-chat/pull/4431))
- Allow users to save named cryptocurrency accounts ([#4434](https://github.com/open-chat-labs/open-chat/pull/4434))

### Changed

- Use canister timers to remove expired events ([#4447](https://github.com/open-chat-labs/open-chat/pull/4447))

## [[2.0.852](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.852-user)] - 2023-09-18

### Added

- Add `default_channel_rules` to `create_community` ([#4387](https://github.com/open-chat-labs/open-chat/pull/4374))

### Changed

- Include username and display name updates in updates loop ([#4343](https://github.com/open-chat-labs/open-chat/pull/4343))
- Add `last_updated` to direct chat summaries ([#4364](https://github.com/open-chat-labs/open-chat/pull/4364))
- Add `rules_accepted` to cached group summaries ([#4366](https://github.com/open-chat-labs/open-chat/pull/4366))
- Transfer to user specific subaccounts when transferring to bot users ([#4388](https://github.com/open-chat-labs/open-chat/pull/4388))
- Add `CommunityRulesNotAccepted` to `send_channel_message` response ([#?](https://github.com/open-chat-labs/open-chat/pull/?))
 
## [[2.0.838](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.838-user)] - 2023-09-05

### Changed

- Use empty Vec if unconfirmed messages fail to deserialize ([#4304](https://github.com/open-chat-labs/open-chat/pull/4304))

### Fixed

- Convert remaining SNS transactions to ICRC1 ([#4303](https://github.com/open-chat-labs/open-chat/pull/4303))
- Add `serde(default)` attribute to fix upgrade ([#4307](https://github.com/open-chat-labs/open-chat/pull/4307))
- Add more `serde(default)` attributes required for upgrade ([#4309](https://github.com/open-chat-labs/open-chat/pull/4309))

## [[2.0.832](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.832-user)] - 2023-09-01

### Added

- Add optional user `display name` ([#4247](https://github.com/open-chat-labs/open-chat/pull/4247))
- Implement ability to create and update `user_groups` ([#4271](https://github.com/open-chat-labs/open-chat/pull/4271))

### Changed

- Consolidate and simplify user/group/community name validation ([#4265](https://github.com/open-chat-labs/open-chat/pull/4265))

## [[2.0.821](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.821-user)] - 2023-08-24

### Added

- Support manual ordering of communities ([#4201](https://github.com/open-chat-labs/open-chat/pull/4201))

### Changed

- Add support for versioned access rules ([#4159](https://github.com/open-chat-labs/open-chat/pull/4159))
- Extend versioned rules to communities and groups ([#4219](https://github.com/open-chat-labs/open-chat/pull/4219))

### Removed

- Remove SNS transaction types ([#4162](https://github.com/open-chat-labs/open-chat/pull/4162))

## [[2.0.803](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.803-user)] - 2023-08-08

### Changed

- Remove any deleted groups which were missed ([#4117](https://github.com/open-chat-labs/open-chat/pull/4117))
- Convert `SNS` transactions to `ICRC1` ([#4133](https://github.com/open-chat-labs/open-chat/pull/4133))
- More efficient serialization of notifications ([#4134](https://github.com/open-chat-labs/open-chat/pull/4134))
- Consolidate logic to remove group or community from user canister ([#4138](https://github.com/open-chat-labs/open-chat/pull/4138))
- Remove deprecated `pin_chat` and `unpin_chat` ([#4139](https://github.com/open-chat-labs/open-chat/pull/4139))
- Simplify notification types ([#4148](https://github.com/open-chat-labs/open-chat/pull/4148))
- Validate text length based on number of chars rather than bytes ([#4154](https://github.com/open-chat-labs/open-chat/pull/4154))

## [[2.0.775](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.775-user)] - 2023-08-01

### Changed

- Return imported groups in summary updates ([#4082](https://github.com/open-chat-labs/open-chat/pull/4082))
- Return all channel updates after importing to community ([#4087](https://github.com/open-chat-labs/open-chat/pull/4087))

## [[2.0.763](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.763-user)] - 2023-07-28

### Changed

- Switch to using `active_groups` instead of `filter_groups` ([#4003](https://github.com/open-chat-labs/open-chat/pull/4003))
- Mark channels as read after joining community or channel ([#4004](https://github.com/open-chat-labs/open-chat/pull/4004))
- Convert SNS transaction messages into ICRC1 messages ([#4015](https://github.com/open-chat-labs/open-chat/pull/4015))
- Migrate group references to channel references after import ([#4019](https://github.com/open-chat-labs/open-chat/pull/4019))
- Trim messages before pushing them as notifications ([#4020](https://github.com/open-chat-labs/open-chat/pull/4020))
- Support sending any ICRC1 tokens ([#4026](https://github.com/open-chat-labs/open-chat/pull/4026))

### Removed

- Remove a few deprecated methods ([#4006](https://github.com/open-chat-labs/open-chat/pull/4006))
- Consolidate remove and block community permissions ([#4030](https://github.com/open-chat-labs/open-chat/pull/4030))

### Fixed

- Fix check for direct chat updates to include pinned ([#4024](https://github.com/open-chat-labs/open-chat/pull/4024))
- Ensure public channel names are ci unique ([#4044](https://github.com/open-chat-labs/open-chat/pull/4044))

## [[2.0.746](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.746-user)] - 2023-07-19

### Added

- Add `set_message_reminder_v2` to support channel message reminders ([#3871](https://github.com/open-chat-labs/open-chat/pull/3871))
- Add missing impl for `c2c_notify_community_deleted` ([#3914](https://github.com/open-chat-labs/open-chat/pull/3914))
- Add language field to community ([#3923](https://github.com/open-chat-labs/open-chat/pull/3923))

### Changed

- Add `ledger` to pending crypto transactions ([#3866](https://github.com/open-chat-labs/open-chat/pull/3866))
- Switch to the new `OtherChat` reply context when calling c2c ([#3875](https://github.com/open-chat-labs/open-chat/pull/3875))
- Remove dependency on `ic-sns-governance` ([#3965](https://github.com/open-chat-labs/open-chat/pull/3965))
- Call into ICP ledger via the new `icp_ledger_canister_c2c_client` ([#3966](https://github.com/open-chat-labs/open-chat/pull/3966))
- Stop using `transaction_hash` field on SNS transactions ([#3967](https://github.com/open-chat-labs/open-chat/pull/3967))
- Remove dependencies on IC repo ([#3970](https://github.com/open-chat-labs/open-chat/pull/3970))
- Update favourites when a group is deleted or imported into a community ([#3977](https://github.com/open-chat-labs/open-chat/pull/3977))
- Use `canister_client` for making all c2c calls ([#3979](https://github.com/open-chat-labs/open-chat/pull/3979))
- Avoid using `candid::Func` type directly ([#3983](https://github.com/open-chat-labs/open-chat/pull/3983))
- Add `ledger` field to completed crypto transactions ([#3912](https://github.com/open-chat-labs/open-chat/pull/3912))

## [[2.0.736](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.736-user)] - 2023-06-27

### Added

- Support replying to channel messages ([#3825](https://github.com/open-chat-labs/open-chat/pull/3825))
- Support simplified transfers of icrc1 tokens ([#3827](https://github.com/open-chat-labs/open-chat/pull/3827))
- Allow known communities to call `c2c_vote_on_proposal` ([#3831](https://github.com/open-chat-labs/open-chat/pull/3831))
- Implement converting a group into a community ([#3833](https://github.com/open-chat-labs/open-chat/pull/3833))
- Handle when a group is imported into a community ([#3840](https://github.com/open-chat-labs/open-chat/pull/3840))
- Add `c2c_mark_community_updated_for_user` endpoint ([#3846](https://github.com/open-chat-labs/open-chat/pull/3846))

### Changed

- Renamed `add_remove_favourite_chats` to `manage_favourite_chats` ([#3847](https://github.com/open-chat-labs/open-chat/pull/3847))
- Remove invalid replies to old messages in the Feature Requests group ([#3851](https://github.com/open-chat-labs/open-chat/pull/3851))

### Fixed

- Fix ordering of pinned chats ([#3823](https://github.com/open-chat-labs/open-chat/pull/3823))

## [[2.0.726](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.726-user)] - 2023-06-19

### Added

- Add support for sending the KINIC token ([#3811](https://github.com/open-chat-labs/open-chat/pull/3811))
  
### Fixed

- Fix pinned chat changes not coming through in `initial_state_v2` and `updates_v2` ([#3810](https://github.com/open-chat-labs/open-chat/pull/3810))

## [[2.0.725](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.725-user)] - 2023-06-16

### Added

- Introduce `FireAndForgetHandler` which retries failed c2c calls ([#3639](https://github.com/open-chat-labs/open-chat/pull/3639))
- Integrate Communities ([#3657](https://github.com/open-chat-labs/open-chat/pull/3657)), ([#3659](https://github.com/open-chat-labs/open-chat/pull/3659))
- Added `c2c_mark_group_updated_for_user` ([#3685](https://github.com/open-chat-labs/open-chat/pull/3685))
- Include communities in `initial_state`, `updates` and `mark_read` ([#3736](https://github.com/open-chat-labs/open-chat/pull/3736))
- `add_remove_favourite_chats`, `archive_unarchive_chats` ([#3781](https://github.com/open-chat-labs/open-chat/pull/3781))

### Changed

- Change `c2c_remove_from_group` to always remove the user ([#3641](https://github.com/open-chat-labs/open-chat/pull/3641))
- Refactor search ([#3689](https://github.com/open-chat-labs/open-chat/pull/3689))
- Don't send notifications to suspended users ([#3704](https://github.com/open-chat-labs/open-chat/pull/3704))
- Make (de)serializing events more efficient ([#3756](https://github.com/open-chat-labs/open-chat/pull/3756))
- Trim deprecated chat events to save space ([#3773](https://github.com/open-chat-labs/open-chat/pull/3773))
- Further reductions to the size of serialized ChatEvents ([#3775](https://github.com/open-chat-labs/open-chat/pull/3775))
- Reduce size of `ChatMetrics` when serialized ([#3779](https://github.com/open-chat-labs/open-chat/pull/3779))
- Restructure `initial_state` and `updates` ([#3781](https://github.com/open-chat-labs/open-chat/pull/3781))
- Deserialize onto old `ChatEventInternal` types then map to new ([#3798](https://github.com/open-chat-labs/open-chat/pull/3798))

### Removed

- Remove `c2c_try_add_to_group` ([#3661](https://github.com/open-chat-labs/open-chat/pull/3661))

### Fixed

- Fix `updates` returning early in some cases where it shouldn't ([#3743](https://github.com/open-chat-labs/open-chat/pull/3743))

## [[2.0.698](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.698-user)] - 2023-05-17

### Changed

- Short circuit query calls prior to calling `ic0.time()` where possible ([#3542](https://github.com/open-chat-labs/open-chat/pull/3542))
- Added `moderator` role and removed `add_members` permission ([#3592](https://github.com/open-chat-labs/open-chat/pull/3592))
- Put back `add_members` permission with serde default ([#3599](https://github.com/open-chat-labs/open-chat/pull/3599))
- Allow registered bot accounts to start conversations with OC users ([#3591](https://github.com/open-chat-labs/open-chat/pull/3591))

### Removed

- Remove `send_message` and `edit_message` (there are now `v2` versions) ([#3578](https://github.com/open-chat-labs/open-chat/pull/3578))

### Fixed

- Fix `last_updated` date on group chats ([#3609](https://github.com/open-chat-labs/open-chat/pull/3609))

## [[2.0.676](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.676-user)] - 2023-04-29

### Added

- Allow users to `Delete For Me` in direct chats ([#3498](https://github.com/open-chat-labs/open-chat/pull/3498))
- Implement `send_message_v2` and `edit_message_v2` ([#3504](https://github.com/open-chat-labs/open-chat/pull/3504))
- Allow users to undelete messages for a short period in direct chats ([#3529](https://github.com/open-chat-labs/open-chat/pull/3529))

### Changed

- Switch replies over to the new `event_list_if_other` field ([#3465](https://github.com/open-chat-labs/open-chat/pull/3465))
- Use hardcoded ledger ids ([#3452](https://github.com/open-chat-labs/open-chat/pull/3452))
- Added `created` to pending transactions ([#3494](https://github.com/open-chat-labs/open-chat/pull/3494))
- Skip c2c calls to the OpenChat bot ([#3508](https://github.com/open-chat-labs/open-chat/pull/3508))
- Pass OpenChat bot messages in user canister init args ([#3517](https://github.com/open-chat-labs/open-chat/pull/3517))

### Removed

- Remove all but one OpenChatBot welcome message ([#3478](https://github.com/open-chat-labs/open-chat/pull/3478))

## [[2.0.660](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.660-user)] - 2023-04-16

### Added

- Added `set_message_reminder` ([#3417](https://github.com/open-chat-labs/open-chat/pull/3417))
- Implement 'Gated Groups' ([#3406](https://github.com/open-chat-labs/open-chat/pull/3406))
- Added `Empty` event type ([#3439](https://github.com/open-chat-labs/open-chat/pull/3439))
- Added new message content types for reminders ([#3440](https://github.com/open-chat-labs/open-chat/pull/3440))
- Added new `Custom` message content type ([#3445](https://github.com/open-chat-labs/open-chat/pull/3445))

### Changed

- Simplify how we make calls to the SNS governance canister ([#3405](https://github.com/open-chat-labs/open-chat/pull/3405))
- Store `diamond_membership_expires_at` in each user canister ([#3428](https://github.com/open-chat-labs/open-chat/pull/3428))
- Send message reminders as private replies ([#3431](https://github.com/open-chat-labs/open-chat/pull/3431))
- Send OpenChat bot message when setting a message reminder ([#3436](https://github.com/open-chat-labs/open-chat/pull/3436))
- Hide 'reminder created' messages when cancelled or complete ([#3446](https://github.com/open-chat-labs/open-chat/pull/3446))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-chat-labs/open-chat/pull/3375))
- Removed `affected_events` which has been superseded by `updated_events` ([#3419](https://github.com/open-chat-labs/open-chat/pull/3419))
- Removed transfer limits ([#3457](https://github.com/open-chat-labs/open-chat/pull/3457))

## [[2.0.645](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.645-user)] - 2023-03-25

### Added

- Store and use last updated timestamp on each event ([#3326](https://github.com/open-chat-labs/open-chat/pull/3326))
- Added `timestamp` to `EventsResponse` ([#3329](https://github.com/open-chat-labs/open-chat/pull/3329))

### Changed

- Update group chat summary cache in small batches ([#3341](https://github.com/open-chat-labs/open-chat/pull/3341))
- Don't allow platform moderators to be removed from a group ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248)) & ([#3251](https://github.com/open-chat-labs/open-chat/pull/3251))
- Removed unused timer job type (`RetrySendingFailedMessage`) ([#3263](https://github.com/open-chat-labs/open-chat/pull/3263))
- Removed `affected_events` from event responses ([#3322](https://github.com/open-chat-labs/open-chat/pull/3322))
- Removed super_admin role from groups([#3319](https://github.com/open-chat-labs/open-chat/pull/3319))
- Remove owner_id from group summary ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))

### Fixed

- Fix threads incorrectly appearing unread ([#3351](https://github.com/open-chat-labs/open-chat/pull/3351))

## [[2.0.622](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.622-user)] - 2023-03-01

### Added

- Add CHAT ledger to user and group canisters ([#3222](https://github.com/open-chat-labs/open-chat/pull/3222))
- Added `hot_group_exclusions` ([#3246](https://github.com/open-chat-labs/open-chat/pull/3246))

### Fixed

- Rejoin 'Feature Requests' group if user was a member before it was reinstalled ([#3163](https://github.com/open-chat-labs/open-chat/pull/3163))

## [[2.0.596](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.596-user)] - 2023-02-16

### Changed

- Stop using `MemoryManager` during `post_upgrade` ([#3130](https://github.com/open-chat-labs/open-chat/pull/3130))

### Fixed

- Fix-up ledger ids ([#3143](https://github.com/open-chat-labs/open-chat/pull/3143))

## [[2.0.593](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.593-user)] - 2023-02-11

### Changed

- Reduce min interval between cycles balance checks ([#3058](https://github.com/open-chat-labs/open-chat/pull/3058))
- Deserialize using `MemoryManager` within `post_upgrade` ([#3066](https://github.com/open-chat-labs/open-chat/pull/3066))
- Reduce `MemoryManager` bucket size to 1 wasm page ([#3070](https://github.com/open-chat-labs/open-chat/pull/3070))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))
- Drop stable memory after upgrade ([#3116](https://github.com/open-chat-labs/open-chat/pull/3116))
- Temporarily stop using `MemoryManager` during `pre_upgrade` ([#3122](https://github.com/open-chat-labs/open-chat/pull/3122))

### Removed

- Removed one-time code to fix incorrect ICP transaction hashes ([#3063](https://github.com/open-chat-labs/open-chat/pull/3063))
- Removed one-time code to migrate `chat_events` to the new format ([#3064](https://github.com/open-chat-labs/open-chat/pull/3064))

### Fixed

- Fixed latest message not being returned when getting updates ([#3120](https://github.com/open-chat-labs/open-chat/pull/3120))

## [[2.0.578](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.578-user)] - 2023-02-04

### Added

- Added `disappears_at` to events ([#3021](https://github.com/open-chat-labs/open-chat/pull/3021))
- Support disappearing messages ([#3029](https://github.com/open-chat-labs/open-chat/pull/3029))
- Added support for "prize" messages ([#3044](https://github.com/open-chat-labs/open-chat/pull/3044))

### Changed

- Refactor and simplify `chat_events` ([#3013](https://github.com/open-chat-labs/open-chat/pull/3013))
- Renamed `disappears_at` to `expires_at` ([#3023](https://github.com/open-chat-labs/open-chat/pull/3023))
- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))
- Increase pinned chats limit ([#2998](https://github.com/open-chat-labs/open-chat/pull/2998))

### Fixed

- One time job to fix incorrect ICP transaction hashes ([#3035](https://github.com/open-chat-labs/open-chat/pull/3035))
- Fix 'double borrowing' error when hard deleting files ([#3051](https://github.com/open-chat-labs/open-chat/pull/3051))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))
- Removed `c2c_send_message` ([#3005](https://github.com/open-chat-labs/open-chat/pull/3005))
- Removed `events_range` ([#3011](https://github.com/open-chat-labs/open-chat/pull/3011))
- Remove one time fix to user date created ([#2994](https://github.com/open-chat-labs/open-chat/pull/2994))

## [[2.0.555](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.555-user)] - 2023-01-20

### Fixed

- Fix bug sending messages from canisters on v2.0.547 to canisters on version v2.0.553 and resend failed messages ([#2995](https://github.com/open-chat-labs/open-chat/pull/2995))

## [[2.0.553](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.553-user)] - 2023-01-20

### Added

- Add SNS1 token to backend ([#2975](https://github.com/open-chat-labs/open-chat/pull/2975))
- Add ckBTC token to backend ([#2981](https://github.com/open-chat-labs/open-chat/pull/2981))
- Support for assigning nicknames to other users ([#2982](https://github.com/open-chat-labs/open-chat/pull/2982))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))
- Ensure direct messages are received by the recipient's canister in the same order they were received by the sender's canister, even if some fail to be sent c2c on first attempt ([#2986](https://github.com/open-chat-labs/open-chat/pull/2986))
- Use timestamp in nanos not ms for ICRC1 Transfers ([#2988](https://github.com/open-chat-labs/open-chat/pull/2988))
 
### Removed

- Removed `join_group` since this is now handled via the `local_user_index` canister ([#2966](https://github.com/open-chat-labs/open-chat/pull/2966))

## [[2.0.547](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.547-user)] - 2023-01-08

### Added

- Added `UserJoinedGroup` event type for supporting the new `join_group` flow ([#2955](https://github.com/open-chat-labs/open-chat/pull/2955))
- Added `c2c_notify_events` which deprecates `c2c_notify_user_events` ([#2955](https://github.com/open-chat-labs/open-chat/pull/2955))
- Allow admins and senders to see deleted message content ([#2922](https://github.com/open-chat-labs/open-chat/pull/2922))

### Changed

- Added `max_messages` to `events` and `events_window` ([#2947](https://github.com/open-chat-labs/open-chat/pull/2947))

### Removed 

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-chat-labs/open-chat/pull/2954))
