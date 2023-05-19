# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Split common group logic into new `group_chat_core` library ([#3620](https://github.com/open-ic/open-chat/pull/3620))
- Simplify `c2c_update_proposals` ([#3621](https://github.com/open-ic/open-chat/pull/3621))
- Move `delete_messages` into `group_chat_core` ([#3622](https://github.com/open-ic/open-chat/pull/3622))

### Removed

- Remove last remnants of `send_message` and `edit_message` ([#3603](https://github.com/open-ic/open-chat/pull/3603))

## [[2.0.690](https://github.com/open-ic/open-chat/releases/tag/v2.0.690-group)] - 2023-05-16

### Changed

- Return `history_visible_to_new_joiners` from `group::public_summary` ([#3572](https://github.com/open-ic/open-chat/pull/3572))
- Added `moderator` role ([#3592](https://github.com/open-ic/open-chat/pull/3592))

### Removed

- Remove `send_message` and `edit_message` (there are now `v2` versions) ([#3578](https://github.com/open-ic/open-chat/pull/3578))
- Remove `add_participants` endpoint and `add_members` permission ([#3589](https://github.com/open-ic/open-chat/pull/3589))

### Fixed

- Fix issue with group accessibility ([#3600](https://github.com/open-ic/open-chat/pull/3600))

## [[2.0.686](https://github.com/open-ic/open-chat/releases/tag/v2.0.686-group)] - 2023-05-11

### Added

- Re-introduce invite by code on backend ([#3552](https://github.com/open-ic/open-chat/pull/3552))

### Changed

- Short circuit without calling `ic0.time()` if there have been no updates ([#3539](https://github.com/open-ic/open-chat/pull/3539))
- Short circuit query calls prior to calling `ic0.time()` where possible ([#3542](https://github.com/open-ic/open-chat/pull/3542))
- Invited users can't see private group messages ([#3558](https://github.com/open-ic/open-chat/pull/3558))
- Handle `send_message_v2` and `edit_message_v2` in `inspect_message` ([#3560](https://github.com/open-ic/open-chat/pull/3560))

## [[2.0.675](https://github.com/open-ic/open-chat/releases/tag/v2.0.675-group)] - 2023-04-29

### Added

- Implement `edit_message_v2` ([#3504](https://github.com/open-ic/open-chat/pull/3504))
- Supports inviting of specific users ([#3499](https://github.com/open-ic/open-chat/pull/3499))

### Changed

- Use hardcoded ledger ids ([#3452](https://github.com/open-ic/open-chat/pull/3452))
- Allow platform moderators to delete any messages ([#3491](https://github.com/open-ic/open-chat/pull/3491))
- Allow the user index to add group members ([#3493](https://github.com/open-ic/open-chat/pull/3493))
- Added `created` to pending transactions ([#3494](https://github.com/open-ic/open-chat/pull/3494))
- Added ability to `report_message` ([#3497](https://github.com/open-ic/open-chat/pull/3497))
- Only return full details for the first 10 message reports ([#3505](https://github.com/open-ic/open-chat/pull/3505))
- Relax restrictions on who can claim prizes ([#3516](https://github.com/open-ic/open-chat/pull/3516))

### Removed

- Removed invite to private group by link/code ([#3499](https://github.com/open-ic/open-chat/pull/3499))

## [[2.0.662](https://github.com/open-ic/open-chat/releases/tag/v2.0.662-group)] - 2023-04-16

### Added

- Implement 'Gated Groups' ([#3406](https://github.com/open-ic/open-chat/pull/3406))
- Added `register_proposal_vote_v2` for voting on proposals directly from the frontend ([#3413](https://github.com/open-ic/open-chat/pull/3413))
- Added `Empty` event type ([#3439](https://github.com/open-ic/open-chat/pull/3439))
- Added new message content types for reminders ([#3440](https://github.com/open-ic/open-chat/pull/3440))
- Added new `Custom` message content type ([#3445](https://github.com/open-ic/open-chat/pull/3445))

### Removed

- Removed temporary code needed for release ([#3375](https://github.com/open-ic/open-chat/pull/3375))
- Removed `affected_events` which has been superseded by `updated_events` ([#3419](https://github.com/open-ic/open-chat/pull/3419))

## [[2.0.644](https://github.com/open-ic/open-chat/releases/tag/v2.0.644-group)] - 2023-03-24

### Added

- Return group summary if user tries to join group they are already in ([#3296](https://github.com/open-ic/open-chat/pull/3296))
- Store and use last updated timestamp on each event ([#3326](https://github.com/open-ic/open-chat/pull/3326))
- Added `timestamp` to `EventsResponse` ([#3329](https://github.com/open-ic/open-chat/pull/3329))

### Changed

- Support multiple group owners ([#3340](https://github.com/open-ic/open-chat/pull/3340))
- Platform mods can become owners of public groups ([#3340](https://github.com/open-ic/open-chat/pull/3340))

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-ic/open-chat/pull/3248)) & ([#3251](https://github.com/open-ic/open-chat/pull/3251))
- Removed all the code around reinstalling groups ([#3253](https://github.com/open-ic/open-chat/pull/3253))
- Removed `affected_events` from event responses ([#3322](https://github.com/open-ic/open-chat/pull/3322))
- Removed super_admin role from groups([#3319](https://github.com/open-ic/open-chat/pull/3319))

## [[2.0.619](https://github.com/open-ic/open-chat/releases/tag/v2.0.619-group)] - 2023-02-28

### Added

- Added `payload_text_rendering` to SNS proposals ([#3175](https://github.com/open-ic/open-chat/pull/3175))
- Push activity notification when (un)freezing a group ([#3195](https://github.com/open-ic/open-chat/pull/3195))
- Add CHAT ledger to user and group canisters ([#3222](https://github.com/open-ic/open-chat/pull/3222))

### Fixed

- Set all `notifications_muted` dates to `now` to fix data inconsistency ([#3227](https://github.com/open-ic/open-chat/pull/3227))

## [[2.0.606](https://github.com/open-ic/open-chat/releases/tag/v2.0.606-group)] - 2023-02-20

### Fixed

- Handle the invalid users who joined groups before we had a check in place ([#3162](https://github.com/open-ic/open-chat/pull/3162))

## [[2.0.604](https://github.com/open-ic/open-chat/releases/tag/v2.0.604-group)] - 2023-02-17

### Added

- Added `c2c_initialize_events` for recovering groups which are un-upgradable due to bug in `pre_upgrade` ([#3128](https://github.com/open-ic/open-chat/pull/3128))
- Added `c2c_events_internal` for recovering group events ([#3138](https://github.com/open-ic/open-chat/pull/3138))
- Added `c2c_name_and_members` which is called by the GroupIndex before deleting the group ([#3144](https://github.com/open-ic/open-chat/pull/3144))

### Removed

- Removed code to initialize `proposals_bot_user_id` value ([#3124](https://github.com/open-ic/open-chat/pull/3124))

### Fixed

- Fixed latest message not being returned when getting updates ([#3120](https://github.com/open-ic/open-chat/pull/3120))
- Fix-up ledger ids ([#3143](https://github.com/open-ic/open-chat/pull/3143))

## [[2.0.589](https://github.com/open-ic/open-chat/releases/tag/v2.0.589-group)] - 2023-02-10

### Changed

- Update cdk to v0.7.0 ([#3115](https://github.com/open-ic/open-chat/pull/3115))
- Drop stable memory after upgrade ([#3116](https://github.com/open-ic/open-chat/pull/3116))

## [[2.0.583](https://github.com/open-ic/open-chat/releases/tag/v2.0.583-group)] - 2023-02-09

### Changed

- Use `raw_rand` to seed rng ([#3076](https://github.com/open-ic/open-chat/pull/3076))
- Only allow proposal messages sent by the ProposalsBot ([#3080](https://github.com/open-ic/open-chat/pull/3080))
- Add "claim_prize" to group inspect_message ([#3084](https://github.com/open-ic/open-chat/pull/3084))

## [[2.0.579](https://github.com/open-ic/open-chat/releases/tag/v2.0.579-group)] - 2023-02-06

### Added

- Added transaction details to `PrizeWinnerContent` ([#3055](https://github.com/open-ic/open-chat/pull/3055))

### Changed

- Reduce min interval between cycles balance checks ([#3058](https://github.com/open-ic/open-chat/pull/3058))
- Deserialize using `MemoryManager` within `post_upgrade` ([#3066](https://github.com/open-ic/open-chat/pull/3066))
- Reduce `MemoryManager` bucket size to 1 wasm page ([#3070](https://github.com/open-ic/open-chat/pull/3070))

### Removed

- Removed one-time code to fix incorrect ICP transaction hashes ([#3063](https://github.com/open-ic/open-chat/pull/3063))
- Removed one-time code to migrate `chat_events` to the new format ([#3064](https://github.com/open-ic/open-chat/pull/3064))

## [[2.0.577](https://github.com/open-ic/open-chat/releases/tag/v2.0.577-group)] - 2023-02-03

### Added

- Added `disappears_at` to events ([#3021](https://github.com/open-ic/open-chat/pull/3021))
- Support disappearing messages ([#3029](https://github.com/open-ic/open-chat/pull/3029))
- Added support for "prize" messages ([#3044](https://github.com/open-ic/open-chat/pull/3044))

### Changed

- Refactor and simplify `chat_events` ([#3013](https://github.com/open-ic/open-chat/pull/3013))
- Mark group as active after ending a poll ([#3017](https://github.com/open-ic/open-chat/pull/3017))
- Renamed `disappears_at` to `expires_at` ([#3023](https://github.com/open-ic/open-chat/pull/3023))
- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-ic/open-chat/pull/3040))

### Fixed

- One time job to fix incorrect ICP transaction hashes ([#3035](https://github.com/open-ic/open-chat/pull/3035))
- Fix 'double borrowing' error when hard deleting files ([#3051](https://github.com/open-ic/open-chat/pull/3051))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-ic/open-chat/pull/3003))
- Removed `events_range` ([#3011](https://github.com/open-ic/open-chat/pull/3011))

## [[2.0.552](https://github.com/open-ic/open-chat/releases/tag/v2.0.552-group)] - 2023-01-20

### Added

- Add SNS1 token to backend ([#2975](https://github.com/open-ic/open-chat/pull/2975))
- Add ckBTC token to backend ([#2981](https://github.com/open-ic/open-chat/pull/2981))

### Changed

- Skip processing notifications with no recipients ([#2979](https://github.com/open-ic/open-chat/pull/2979))
- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-ic/ic-utils) ([#2985](https://github.com/open-ic/open-chat/pull/2985))

### Removed

- Removed `join_group_v2` which has been superseded by the new `join_group` ([#2966](https://github.com/open-ic/open-chat/pull/2966))

## [[2.0.546](https://github.com/open-ic/open-chat/releases/tag/v2.0.546-group)] - 2023-01-08

### Added

- Allow admins and senders to see deleted message content ([#2922](https://github.com/open-ic/open-chat/pull/2922))

### Changed

- Added `max_messages` to `events` and `events_window` ([#2947](https://github.com/open-ic/open-chat/pull/2947))

### Removed

- Removed one-time code only needed for previous upgrade ([#2954](https://github.com/open-ic/open-chat/pull/2954))
