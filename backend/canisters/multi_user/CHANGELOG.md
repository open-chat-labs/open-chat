# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.2197](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2197-multi_user)] - 2026-10-27

### Added

- Price charts, a message type only bots post, which anyone can forward ([#10267](https://github.com/open-chat-labs/open-chat/pull/10267))

### Removed

- Remove the old names of the endpoints which the event endpoints replaced, as nothing calls them any more ([#10172](https://github.com/open-chat-labs/open-chat/pull/10172))
- Stop reading removals sent apart from the other group and community events, which no group or community sends any more ([#10258](https://github.com/open-chat-labs/open-chat/pull/10258))

### Fixed

- Reject tips to bots ([#10262](https://github.com/open-chat-labs/open-chat/pull/10262))

## [[2.0.2184](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2184-multi_user)] - 2026-10-22

### Changed

- Send its events to its LocalUserIndex and other MultiUser canisters at `c2c_user` ([#10050](https://github.com/open-chat-labs/open-chat/pull/10050))

### Fixed

- Stop retrying events for a user whose old User canister was uninstalled after running out of cycles, once they're found to be gone ([#10063](https://github.com/open-chat-labs/open-chat/pull/10063))
- Wait out a failed batch's retry delay, rather than retrying it whenever anything else is queued ([#10069](https://github.com/open-chat-labs/open-chat/pull/10069))

## [[2.0.2167](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2167-multi_user)] - 2026-10-20

### Added

- Add `c2c_local_index`, `c2c_group`, `c2c_community` and `c2c_user` for the LocalUserIndex's, Group, Community and other MultiUser canisters' events, to replace the `_canister` and `_v2` names ([#10047](https://github.com/open-chat-labs/open-chat/pull/10047))
- Add `c2c_escrow` for the Escrow canister's swap status changes, in idempotent envelopes ([#10047](https://github.com/open-chat-labs/open-chat/pull/10047))

### Changed

- Send its events to its LocalUserIndex and other MultiUser canisters at `c2c_user` ([#10050](https://github.com/open-chat-labs/open-chat/pull/10050))

## [[2.0.2157](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2157-multi_user)] - 2026-10-19

### Added

- Take the GroupIndex's group and community deleted events for every user in the canister in one call ([#10010](https://github.com/open-chat-labs/open-chat/pull/10010))

### Changed

- Accept Bitcoin, Ethereum and Solana addresses in the address book, as well as ICRC-1 accounts and ICP account identifiers ([#10008](https://github.com/open-chat-labs/open-chat/pull/10008))
- Send avatar changes to the UserIndex via the LocalUserIndex ([#10011](https://github.com/open-chat-labs/open-chat/pull/10011))

### Removed

- Remove the endpoints to add/remove platform operators ([#10011](https://github.com/open-chat-labs/open-chat/pull/10011))

## [[2.0.2153](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2153-multi_user)] - 2026-10-19

### Added

- Generate Solana deposit addresses through the ckSOL minter, and have it credit SOL sent to them as ckSOL ([#9984](https://github.com/open-chat-labs/open-chat/pull/9984))
- Have SOL deposits minted to the canister, which forwards them to the user's wallet less a fee of 0.002 SOL for their first and 0.001 SOL after, and tells them via the OpenChat bot ([#9987](https://github.com/open-chat-labs/open-chat/pull/9987))
- Hold the Alchemy API key set by a platform operator, for checking Solana balances ([#9995](https://github.com/open-chat-labs/open-chat/pull/9995))
- Check a user's SOL deposit address through Alchemy before paying the ckSOL minter to check it ([#9996](https://github.com/open-chat-labs/open-chat/pull/9996))

### Changed

- Look up the latest id of a P2P swap's offerer named by their old id in the LocalUserIndex ([#9970](https://github.com/open-chat-labs/open-chat/pull/9970))
- Stop tracking the async work in progress, since nothing reads it any more ([#9972](https://github.com/open-chat-labs/open-chat/pull/9972))

### Removed

- Remove the job which rewrote every direct chat into the new format ([#9968](https://github.com/open-chat-labs/open-chat/pull/9968))
- Remove the code which read event data from the heap now that it has all moved into stable memory ([#9968](https://github.com/open-chat-labs/open-chat/pull/9968))
- Remove the jobs which replaced users' old ids, and the mapping of old ids to new, now that every id held is the latest ([#9970](https://github.com/open-chat-labs/open-chat/pull/9970))

## [[2.0.2143](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2143-multi_user)] - 2026-10-14

### Changed

- Replace the ids users had before being migrated with their latest ids in every event ([#9929](https://github.com/open-chat-labs/open-chat/pull/9929))
- Move each user's chats, blocks and contacts off other users' old ids ([#9933](https://github.com/open-chat-labs/open-chat/pull/9933))
- Replace the ids of mentioned users and of direct chats replied to with their latest ids ([#9939](https://github.com/open-chat-labs/open-chat/pull/9939))
- Move everything else users hold outside their chats' events off old user ids ([#9942](https://github.com/open-chat-labs/open-chat/pull/9942))
- Tell the LocalUserIndex when the jobs replacing migrated users' old ids have completed ([#9949](https://github.com/open-chat-labs/open-chat/pull/9949))
- Show in the metrics whether the jobs replacing migrated users' old ids were last reported complete ([#9950](https://github.com/open-chat-labs/open-chat/pull/9950))
- Resolve a User canister's id to the user's latest id when blocking, adding a contact or paying a user in another canister, and refuse one which can't be resolved ([#9953](https://github.com/open-chat-labs/open-chat/pull/9953))
- Replace old user ids in the mentions in report notes and bot command text ([#9954](https://github.com/open-chat-labs/open-chat/pull/9954))
- Rewrite every direct chat into the new format ([#9956](https://github.com/open-chat-labs/open-chat/pull/9956))

### Removed

- Remove importing users from User canisters ([#9919](https://github.com/open-chat-labs/open-chat/pull/9919))
- Remove the `withdraw_btc` and `withdraw_via_one_sec` stubs ([#9921](https://github.com/open-chat-labs/open-chat/pull/9921))
- Remove what was only needed while users were being migrated, including the `UserIdMigrated` event and reading the heap layouts kept for imported users ([#9922](https://github.com/open-chat-labs/open-chat/pull/9922))
- Remove the endpoints the website only called for users outside MultiUser canisters: `swap_tokens`, `approve_transfer`, `withdraw_crypto_v2`, `token_swap_status` and `c2c_withdraw_from_icpswap` ([#9924](https://github.com/open-chat-labs/open-chat/pull/9924))
- Stop reading chat events data held on the heap from before it was moved into stable memory ([#9955](https://github.com/open-chat-labs/open-chat/pull/9955))

### Fixed

- Fix saving an address under a name with multi-byte characters, and renaming one to a name already in use ([#9944](https://github.com/open-chat-labs/open-chat/pull/9944))

## [[2.0.2136](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2136-multi_user)] - 2026-10-12

### Changed

- Pass on the new `tip_messages` permission when creating a group ([#9902](https://github.com/open-chat-labs/open-chat/pull/9902))

### Removed

- Remove the unused `c2c_notify_achievement` endpoint ([#9899](https://github.com/open-chat-labs/open-chat/pull/9899))

## [[2.0.2128](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2128-multi_user)] - 2026-10-11

### Added

- Record the swaps users make straight from their own wallets, so that one left part way through can be finished off ([#9887](https://github.com/open-chat-labs/open-chat/pull/9887))

### Changed

- Check the user's PIN as they start a swap from their wallet ([#9891](https://github.com/open-chat-labs/open-chat/pull/9891))

### Fixed

- Drop events for users who have deleted their account or are bots, rather than retrying them forever ([#9886](https://github.com/open-chat-labs/open-chat/pull/9886))

## [[2.0.2121](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2121-multi_user)] - 2026-10-08

### Changed

- Cancel the job to mark a P2P swap expired, and record the swap as ended, once it has ended ([#9832](https://github.com/open-chat-labs/open-chat/pull/9832))

## [[2.0.2109](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2109-multi_user)] - 2026-10-07

### Added

- Let a user reset a forgotten PIN by signing in again ([#9815](https://github.com/open-chat-labs/open-chat/pull/9815))

### Changed

- Update the OpenChat bot message sent to users after their account is migrated ([#9814](https://github.com/open-chat-labs/open-chat/pull/9814))

### Removed

- Remove the one-off which moved every user's direct chats, groups and communities into stable memory, which has run in prod ([#9813](https://github.com/open-chat-labs/open-chat/pull/9813))

### Fixed

- Accept tips on a migrated user's direct messages sent before their migration ([#9816](https://github.com/open-chat-labs/open-chat/pull/9816))

## [[2.0.2101](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2101-multi_user)] - 2026-10-06

### Added

- Send each migrated user an OpenChat bot message detailing their new wallet address ([#9763](https://github.com/open-chat-labs/open-chat/pull/9763))
- Add `check_pin_number`, so a payment's PIN can be checked before the user approves it ([#9777](https://github.com/open-chat-labs/open-chat/pull/9777))
- Schedule the timer jobs a migrated user's canister handed over during migration ([#9779](https://github.com/open-chat-labs/open-chat/pull/9779))

### Changed

- Keep a minimum balance of 10T cycles, rather than the User canister's 0.3T ([#9735](https://github.com/open-chat-labs/open-chat/pull/9735))
- Take a User canister missing a method as a sign its user may have been migrated, as the other canisters do ([#9743](https://github.com/open-chat-labs/open-chat/pull/9743))
- Check the cycles balance as background jobs run, not only as updates are handled ([#9747](https://github.com/open-chat-labs/open-chat/pull/9747))
- Ask for a top up once the cycles above the freezing threshold fall below 10T, or below twice the threshold ([#9748](https://github.com/open-chat-labs/open-chat/pull/9748))
- Store each direct chat record in stable memory, keeping only a small entry per chat on the heap ([#9781](https://github.com/open-chat-labs/open-chat/pull/9781))
- Store each group and community record in stable memory, keeping only a small entry for each on the heap ([#9795](https://github.com/open-chat-labs/open-chat/pull/9795))
- Instantiate the msgpack (de)serializers of widely shared types once, in `types`, cutting the code by 364KB ([#9804](https://github.com/open-chat-labs/open-chat/pull/9804))
- Limit how many reminders, saved crypto accounts, favourites, pins and manual wallet tokens a user can have ([#9805](https://github.com/open-chat-labs/open-chat/pull/9805))
- Bump the rmp-serde fork to one which reads numbers before visiting them, cutting the code by 849KB ([#9808](https://github.com/open-chat-labs/open-chat/pull/9808))

## [[2.0.2091](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2091-multi_user)] - 2026-10-02

### Added

- Add the MultiUser canister skeleton with its lifecycle endpoints ([#9310](https://github.com/open-chat-labs/open-chat/pull/9310))
- Initialise the stable memory map, alongside a second map with 256 byte pages for small entries ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))
- Add an unimplemented stub for every User canister endpoint, sharing the User canister's API types ([#9400](https://github.com/open-chat-labs/open-chat/pull/9400))
- Add the `Users` collection and per-user `User` state, `c2c_create_user` for the LocalUserIndex to add a user, and implement `bio` ([#9407](https://github.com/open-chat-labs/open-chat/pull/9407))
- Implement `send_message_v2`, `events`, `events_by_index`, `events_window` and `delete_direct_chat` for direct chats between users in the same canister, with the two users sharing one copy of the chat's events, plus `direct_chat_cores` and `stable_memory_keys_to_garbage_collect` metrics ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Hold each user's direct chats as `DirectChatEntry`s made by the `DirectChatCores` alongside their cores ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Check the thread root before pushing a message and let a user who got a chat back read the threads under the roots they can see ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Leave the threads under the messages a user cannot see out of their summary updates ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Return an error rather than trapping for messages with transfers and recipients in other canisters, until they are supported ([#9409](https://github.com/open-chat-labs/open-chat/pull/9409))
- Implement `initial_state` and `updates` for a user's direct chats, alongside `mark_read`, `mute_notifications`, `unmute_notifications`, `archive_unarchive_chats`, `pin_chat_v2` and `unpin_chat_v2`, and report deleted chats through `updates` ([#9413](https://github.com/open-chat-labs/open-chat/pull/9413))
- Return an error rather than trapping when `delete_direct_chat` is asked to block the user, until blocking is supported ([#9413](https://github.com/open-chat-labs/open-chat/pull/9413))
- Hold each user's avatar, profile background, blocked users, contacts, favourite chats and wallet config, and report them through `initial_state` and `updates` ([#9414](https://github.com/open-chat-labs/open-chat/pull/9414))
- Implement `set_avatar`, `set_profile_background`, `set_bio`, `block_user`, `unblock_user`, `set_contact`, `contacts`, `manage_favourite_chats`, `configure_wallet` and `public_profile` ([#9414](https://github.com/open-chat-labs/open-chat/pull/9414))
- Support pinning favourite chats, blocking the other user when deleting a direct chat, and reject messages to users the sender has blocked ([#9414](https://github.com/open-chat-labs/open-chat/pull/9414))
- Implement `edit_message_v2`, `delete_messages`, `undelete_messages`, `add_reaction`, `remove_reaction`, `deleted_message` and `messages_by_message_index` for direct chats between users in the same canister, applying each change to both copies of the chat, plus a timer job to hard delete deleted message content, which undeleting a message cancels, and a `timer_jobs` metric ([#9430](https://github.com/open-chat-labs/open-chat/pull/9430))
- Implement `search_messages`, `update_chat_settings` (disappearing messages, with a per-user job to remove expired events), `message_activity_feed` and `mark_message_activity_feed_read`, recording reactions in the message sender's activity feed and reporting the feed's summary through `initial_state` and `updates` ([#9433](https://github.com/open-chat-labs/open-chat/pull/9433))
- Implement `local_user_index`, `saved_crypto_accounts`, `save_crypto_account`, `delete_saved_crypto_account`, `hot_group_exclusions`, `add_hot_group_exclusions`, `add_recommended_group_exclusions` and `set_pin_number`, holding each user's saved crypto accounts, hot group exclusions and PIN number, and report the PIN number settings through `initial_state` and `updates` ([#9434](https://github.com/open-chat-labs/open-chat/pull/9434))
- Send events to the LocalUserIndex over a queue, each naming the user it is from: notifications of direct messages, and blocking, unblocking and setting a profile background ([#9435](https://github.com/open-chat-labs/open-chat/pull/9435))
- Hold CHIT, the daily claim streak and achievements per user, implementing `claim_daily_chit`, `chit_events` and `mark_achievements_seen`, awarding achievements as the User canister does, and telling the LocalUserIndex of each user's CHIT ([#9438](https://github.com/open-chat-labs/open-chat/pull/9438))
- Send messages from the OpenChat bot to each user's chat with it, and implement `set_message_reminder_v2` and `cancel_message_reminder`, with a timer job which sends each reminder, plus the OpenChat bot's message when streak insurance is claimed ([#9439](https://github.com/open-chat-labs/open-chat/pull/9439))
- Implement `c2c_game_chit` and `c2c_set_user_suspended`, holding each user's game CHIT keys ([#9440](https://github.com/open-chat-labs/open-chat/pull/9440))
- Implement `pay_for_streak_insurance`, paying from the user's subaccount of the canister or an approved account, and the per-user job which uses up a day of streak insurance or resets it when a streak ends ([#9441](https://github.com/open-chat-labs/open-chat/pull/9441))
- Hold each user's groups and communities: implement `create_group`, `create_community`, `leave_group`, `leave_community`, `delete_group`, `delete_community`, `set_community_indexes`, `c2c_group_canister`, `c2c_community_canister`, `c2c_remove_from_group`, `c2c_remove_from_community`, `c2c_notify_group_deleted`, `c2c_notify_community_deleted`, `c2c_groups_and_communities` and the join and Diamond membership events of `c2c_local_user_index`, and include groups and channels in `initial_state`, `updates`, pinning, archiving and `mark_read` ([#9450](https://github.com/open-chat-labs/open-chat/pull/9450))
- Add `c2c_delete_user` for the LocalUserIndex to delete a single user, removing their timer jobs and garbage collecting all of their stable memory map entries ([#9451](https://github.com/open-chat-labs/open-chat/pull/9451))
- Replace `c2c_group_canister`, `c2c_community_canister` and `c2c_local_user_index` with `c2c_group_canister_v2`, `c2c_community_canister_v2` and `c2c_local_user_index_v2`, which take each event paired with the user it is for, so that one call can carry the events for many users ([#9452](https://github.com/open-chat-labs/open-chat/pull/9452))
- Implement `c2c_user_canister_v2`, applying direct chat events from users in other canisters: messages, edits, deletions, reactions, messages read and disappearing message settings ([#9457](https://github.com/open-chat-labs/open-chat/pull/9457))
- Send direct chat events to users in other canisters via their `c2c_user_canister_v2`, looking up recipients the sender has no chat with in the LocalUserIndex: messages, edits, deletions, reactions, messages read and disappearing message settings ([#9458](https://github.com/open-chat-labs/open-chat/pull/9458))
- Hold each user's phone verification, storage limit, unique person proof, external achievements and referrals, applying the `PhoneNumberConfirmed`, `StorageUpgraded`, `ReferredUserRegistered`, `OpenChatBotMessageV2`, `NotifyUniquePersonProof`, `ExternalAchievementAwarded` and `ReinstateMissedDailyClaims` events with their OpenChat bot messages, telling a user's referrer when they reach Diamond or prove personhood, and applying `SetReferralStatus` from referred users, as the User canister does ([#9464](https://github.com/open-chat-labs/open-chat/pull/9464))
- Implement `c2c_grant_super_admin` and `c2c_revoke_super_admin`, and `c2c_pay_for_premium_item`, `c2c_notify_achievement` and `report_message` with their logic shared with the User canister via `user_core` ([#9477](https://github.com/open-chat-labs/open-chat/pull/9477))
- Implement `token_swap_status`, `token_swaps`, `c2c_bot_chat_summary` and `c2c_can_issue_access_token_v2`, sharing their logic with the User canister via `user_core` ([#9478](https://github.com/open-chat-labs/open-chat/pull/9478))
- Install, update and uninstall bots per user (`c2c_install_bot`, `update_bot`, `c2c_uninstall_bot`, and the `BotUpdated` and `BotRemoved` events), and implement `join_video_call`, sharing the logic with the User canister via `user_core` ([#9479](https://github.com/open-chat-labs/open-chat/pull/9479))
- Implement `c2c_charge_user_account` and `withdraw_crypto_v2`, sharing the ledger helpers and charging logic with the User canister ([#9480](https://github.com/open-chat-labs/open-chat/pull/9480))
- Implement `generate_btc_address`, `generate_one_sec_address`, `update_btc_balance`, `approve_transfer`, `withdraw_btc` and `withdraw_via_one_sec`, each acting on the subaccount of the user, sharing the logic with the User canister via `user_core` ([#9481](https://github.com/open-chat-labs/open-chat/pull/9481))
- Apply LocalUserIndex events via `user_core`, shared with the User canister, which hands back the side effects to perform ([#9483](https://github.com/open-chat-labs/open-chat/pull/9483))
- Implement video calls: `start_video_call_v2`, `end_video_call_v2`, and the calls' events between users, applied directly between users of the same canister ([#9500](https://github.com/open-chat-labs/open-chat/pull/9500))
- Send the user an `answered_elsewhere` dismissal when they join a call ([#9509](https://github.com/open-chat-labs/open-chat/pull/9509))
- Support crypto in direct chats in `send_message`, renamed from `send_message_v2`, via ICRC2 transfers from the user's wallet or certified transfers they have already made, and remove the `send_message_with_transfer_to_group` and `_to_channel` stubs, since those messages are now sent to Groups and Communities directly ([#9516](https://github.com/open-chat-labs/open-chat/pull/9516))
- Implement `c2c_charge_user_account` and `pay_for_streak_insurance`, taking the payment from the user's wallet via ICRC2 ([#9519](https://github.com/open-chat-labs/open-chat/pull/9519))
- Implement `tip_message` for direct chats, pulling the tip from the user's own wallet via ICRC2, and apply tips received from other users ([#9528](https://github.com/open-chat-labs/open-chat/pull/9528))
- Implement P2P swaps in direct chats (`send_message`, `accept_p2p_swap`, `cancel_p2p_swap` and `c2c_notify_p2p_swap_status_change`) and `c2c_accept_p2p_swap` for swaps in groups and channels, with deposits pulled from each user's wallet via ICRC2 and the escrow canister knowing each user by their principal ([#9531](https://github.com/open-chat-labs/open-chat/pull/9531))
- Implement `c2c_bot_send_message`, sending a bot's message to the user it names, callable only by the LocalUserIndex ([#9532](https://github.com/open-chat-labs/open-chat/pull/9532))
- Add a cache of the latest ids of users migrated to MultiUser canisters, which nothing fills yet ([#9540](https://github.com/open-chat-labs/open-chat/pull/9540))
- Retry sending events for migrated users to their new canister ([#9551](https://github.com/open-chat-labs/open-chat/pull/9551))
- Serve each user's avatar and profile background over HTTP at `/user/{user_index}/avatar` and `/user/{user_index}/profile_background` ([#9555](https://github.com/open-chat-labs/open-chat/pull/9555))
- Tell the UserIndex a user's new avatar id when they set or remove their avatar, as the User canister does ([#9560](https://github.com/open-chat-labs/open-chat/pull/9560))
- Record P2P swaps users create directly in groups and communities ([#9563](https://github.com/open-chat-labs/open-chat/pull/9563))
- Add `c2c_import_user` which starts the `import_user` job for the given user, callable by the LocalUserIndex ([#9587](https://github.com/open-chat-labs/open-chat/pull/9587))
- Add `inspect_message`, accepting ingress messages only from the canister's users and the video call operators ([#9597](https://github.com/open-chat-labs/open-chat/pull/9597))
- Include the imported user's groups and communities in `UserImported`, for them to be told of the user's new id ([#9602](https://github.com/open-chat-labs/open-chat/pull/9602))
- Clear an imported user's BTC and OneSec deposit addresses, which were for their old canister's account ([#9607](https://github.com/open-chat-labs/open-chat/pull/9607))
- Add `c2c_abandon_user_import`, after which a cancelled migration is never imported ([#9610](https://github.com/open-chat-labs/open-chat/pull/9610))
- Push sent, edited and tipped messages, reactions and OpenChat bot messages to the event store, as User canisters do ([#9625](https://github.com/open-chat-labs/open-chat/pull/9625))
- Send the OpenChat bot's welcome messages to each user created by `c2c_create_user`, as a User canister does when installed ([#9643](https://github.com/open-chat-labs/open-chat/pull/9643))
- Delete the files of direct messages which are deleted or expire, record private replies to group messages, and record crypto received as message activity, as the User canister does ([#9644](https://github.com/open-chat-labs/open-chat/pull/9644))
- Ask the LocalUserIndex for a top up when the cycles balance runs low, checked as updates run ([#9646](https://github.com/open-chat-labs/open-chat/pull/9646))
- Support direct chats with bots, but refuse crypto and P2P swaps sent to them ([#9648](https://github.com/open-chat-labs/open-chat/pull/9648))

### Changed

- Update `ic-stable-structures` to a fork which supports choosing the page size of a map ([#9347](https://github.com/open-chat-labs/open-chat/pull/9347))
- Route stable memory map entries by key type to either the main map or the map for small entries ([#9348](https://github.com/open-chat-labs/open-chat/pull/9348))
- Prefix every stable memory map key with the index of the user it belongs to, applied at the boundary of the map so the key types are unchanged ([#9406](https://github.com/open-chat-labs/open-chat/pull/9406))
- Take the GroupIndex, Identity and Escrow canister ids and the video call operators in the init args, and include the user count in the metrics ([#9407](https://github.com/open-chat-labs/open-chat/pull/9407))
- Give each user their own copy of a direct chat, as in the User canister, rather than the two users sharing one copy of its events, and deliver messages and read receipts between the copies of two users in the same canister directly ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
- Drop messages and read receipts from a user the recipient has blocked on the recipient's side, as between User canisters, so a chat deleted by one user is unaffected on the other's side and comes back as a fresh copy when they are messaged again ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
- Garbage collect a deleted chat's stable memory entries within the scope of the user who deleted it, and remove the `direct_chat_cores` metric ([#9415](https://github.com/open-chat-labs/open-chat/pull/9415))
- Rename the `caller_is_owner` guards to `caller_is_hosted_user`, since the canister hosts many users ([#9432](https://github.com/open-chat-labs/open-chat/pull/9432))
- Verify the caller of `c2c_user_canister_v2` once per call rather than each sender, by asking the LocalUserIndex, caching the MultiUser canisters it confirms, and skip events from blocked senders ([#9459](https://github.com/open-chat-labs/open-chat/pull/9459))
- Move `User` into the `user_state` library, shared with the User canister ([#9467](https://github.com/open-chat-labs/open-chat/pull/9467))
- Build `initial_state` and `updates` from the shared `User`, as the User canister does, so they now include the user's bots ([#9469](https://github.com/open-chat-labs/open-chat/pull/9469))
- Rename the `user_state` library to `user_core`, with the state under `model` and one module per shared endpoint under `queries` and `updates` ([#9470](https://github.com/open-chat-labs/open-chat/pull/9470))
- Take the texts of the OpenChat bot's messages from `user_core`, shared with the User canister ([#9471](https://github.com/open-chat-labs/open-chat/pull/9471))
- Validate `create_group` and `create_community` via `user_core`, shared with the User canister ([#9472](https://github.com/open-chat-labs/open-chat/pull/9472))
- Implement `archive_unarchive_chats`, `pin_chat_v2`, `unpin_chat_v2`, `set_contact`, `public_profile`, `contacts`, `chit_events`, `deleted_message` and `messages_by_message_index` via `user_core`, shared with the User canister ([#9473](https://github.com/open-chat-labs/open-chat/pull/9473))
- Implement the `events`, `events_window` and `events_by_index` queries via `user_core`, shared with the User canister ([#9474](https://github.com/open-chat-labs/open-chat/pull/9474))
- Implement `hot_group_exclusions`, `message_activity_feed`, `c2c_groups_and_communities`, `mute_notifications`, `save_crypto_account`, `add_hot_group_exclusions`, `set_community_indexes` and `c2c_set_user_suspended` via `user_core`, shared with the User canister ([#9475](https://github.com/open-chat-labs/open-chat/pull/9475))
- Implement `claim_daily_chit` via `user_core`, shared with the User canister ([#9482](https://github.com/open-chat-labs/open-chat/pull/9482))
- Handle `c2c_notify_group_deleted` via `user_core`, shared with the User canister ([#9484](https://github.com/open-chat-labs/open-chat/pull/9484))
- Share `c2c_game_chit`, `set_bio`, `set_profile_background`, `manage_favourite_chats` and `pay_for_streak_insurance` with the User canister via `user_core` ([#9486](https://github.com/open-chat-labs/open-chat/pull/9486))
- Apply edits, deletes, reactions and TTL changes from other users via `user_core`, shared with the User canister ([#9487](https://github.com/open-chat-labs/open-chat/pull/9487))
- Reject approvals, streak insurance payments, crypto, BTC and OneSec withdrawals, and account charges, which spent from each user's subaccount of the canister, since users hold their own funds in their principal's account ([#9505](https://github.com/open-chat-labs/open-chat/pull/9505))
- Pass in the canister's cache of migrated user ids when interacting with the chat events ([#9541](https://github.com/open-chat-labs/open-chat/pull/9541))
- Track the spawned tasks in progress using `utils::async_work` ([#9546](https://github.com/open-chat-labs/open-chat/pull/9546))
- Also retry sending events for migrated users to their new canister while the cycles refunder is installed in their old one ([#9558](https://github.com/open-chat-labs/open-chat/pull/9558))
- Rename `send_message` back to `send_message_v2`, the name the User canister gives the endpoint whose args and response it takes, so that clients call both canisters the same way ([#9590](https://github.com/open-chat-labs/open-chat/pull/9590))
- Return an error rather than trapping from `swap_tokens` and `c2c_withdraw_from_icpswap`, which aren't supported yet ([#9593](https://github.com/open-chat-labs/open-chat/pull/9593))
- Apply direct chat events between users in the same canister as those from other canisters, so their recipients get the same achievements and notifications ([#9594](https://github.com/open-chat-labs/open-chat/pull/9594))
- Receive direct messages via `user_core`'s `receive_message`, shared with the User canister ([#9631](https://github.com/open-chat-labs/open-chat/pull/9631))
- Run every update through `execute_update` or `execute_update_async`, which flush the queued events once the update is done ([#9642](https://github.com/open-chat-labs/open-chat/pull/9642))
- Handle removal from a group or community sent via its queue of events for users ([#9715](https://github.com/open-chat-labs/open-chat/pull/9715))

### Fixed

- Tell an imported user's direct chat peers their new id, and move a chat, block and contact onto a peer's new id once they migrate ([#9697](https://github.com/open-chat-labs/open-chat/pull/9697))
- Fix bug where disappearing message TTL could skip being set in new direct chats ([#9584](https://github.com/open-chat-labs/open-chat/pull/9584))
- Fix bug where a disappearing message TTL changed twice before the other user received the changes could leave their copy of the direct chat with the earlier TTL ([#9585](https://github.com/open-chat-labs/open-chat/pull/9585))
- Fix bug where a referrer could be rewarded again for a user migrated to a MultiUser canister ([#9628](https://github.com/open-chat-labs/open-chat/pull/9628))
- Send crypto addressed to the recipient's user id to their wallet ([#9674](https://github.com/open-chat-labs/open-chat/pull/9674))
