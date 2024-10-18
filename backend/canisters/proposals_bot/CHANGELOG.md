# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))

## [[2.0.1307](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1307-proposals_bot)] - 2024-08-26

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

### Fixed

- Fix case where messages marked as pushed when they actually failed ([#6284](https://github.com/open-chat-labs/open-chat/pull/6284))

## [[2.0.1237](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1237-proposals_bot)] - 2024-07-16

### Added

- Add `lookup_proposal_message` ([#6031](https://github.com/open-chat-labs/open-chat/pull/6031))

### Fixed

- Handle `top_up_neuron` in `inspect_message` ([#6037](https://github.com/open-chat-labs/open-chat/pull/6037))

## [[2.0.1217](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1217-proposals_bot)] - 2024-07-02

### Added

- Get payload renderings for SNS proposals ([#5977](https://github.com/open-chat-labs/open-chat/pull/5977))

### Changed

- Don't retry c2c calls after getting a `DestinationInvalid` error ([#5732](https://github.com/open-chat-labs/open-chat/pull/5732))
- Don't retry c2c calls after getting a `CanisterMethodNotFound` error ([#5747](https://github.com/open-chat-labs/open-chat/pull/5747))

## [[2.0.1183](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1183-proposals_bot)] - 2024-05-31

### Fixed

- Fix overflow when calculating proposal status ([#5859](https://github.com/open-chat-labs/open-chat/pull/5859))

## [[2.0.1147](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1147-proposals_bot)] - 2024-04-23

### Changed

- Add `block_level_markdown` flag to messages ([#5680](https://github.com/open-chat-labs/open-chat/pull/5680))
- Add ability to top up neurons for submitting proposals ([#5712](https://github.com/open-chat-labs/open-chat/pull/5712))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

## [[2.0.1124](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1124-proposals_bot)] - 2024-03-26

### Fixed

- Fix proposal decision calculation to account for critical proposals ([#5600](https://github.com/open-chat-labs/open-chat/pull/5600))

## [[2.0.1089](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1089-proposals_bot)] - 2024-03-07

### Added

- Reject NNS proposal just before deadline if neuron not already voted ([#5472](https://github.com/open-chat-labs/open-chat/pull/5472))

### Changed

- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))

## [[2.0.1077](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1077-proposals_bot)] - 2024-02-22

### Changed

- Add `minimum_yes_proportion_of_total` to SNS proposals ([#5284](https://github.com/open-chat-labs/open-chat/pull/5284))

### Fixed

- Allow everyone to post in threads in new SNS proposals groups ([#5365](https://github.com/open-chat-labs/open-chat/pull/5365))
- Update thread permissions in proposal groups ([#5373](https://github.com/open-chat-labs/open-chat/pull/5373))

## [[2.0.1027](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1027-proposals_bot)] - 2024-01-25

### Changed

- Simplify timer jobs + make them more efficient ([#5233](https://github.com/open-chat-labs/open-chat/pull/5233))
- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))

## [[2.0.1001](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1001-proposals_bot)] - 2024-01-05

### Fixed

- Fix deadline timestamp on NNS proposals ([#5136](https://github.com/open-chat-labs/open-chat/pull/5136))

## [[2.0.998](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.998-proposals_bot)] - 2024-01-05

### Added

- Show proposal payloads for NNS proposals ([#5072](https://github.com/open-chat-labs/open-chat/pull/5072))

### Changed

- Better formatting of proposal payloads ([#5115](https://github.com/open-chat-labs/open-chat/pull/5115))
- Expose active user submitted proposals in metrics ([#5126](https://github.com/open-chat-labs/open-chat/pull/5126))

### Fixed

- Refund successful user submitted proposals that don't reach majority ([#5123](https://github.com/open-chat-labs/open-chat/pull/5123))
- One time job to process finished user submitted proposals ([#5124](https://github.com/open-chat-labs/open-chat/pull/5124))

## [[2.0.960](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.960-proposals_bot)] - 2023-12-05

### Changed

- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Switch to using `c2c_send_message` when pushing new proposals ([#4895](https://github.com/open-chat-labs/open-chat/pull/4895))

## [[2.0.928](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.928-proposals_bot)] - 2023-11-06

### Added

- Support submitting proposals of type `UpgradeSnsToNextVersion` ([#4670](https://github.com/open-chat-labs/open-chat/pull/4670))
- Support submitting proposals of type `UpgradeSnsControlledCanister` ([#4672](https://github.com/open-chat-labs/open-chat/pull/4672))
- Support submitting proposals of type `ExecuteGenericNervousSystemFunction` ([#4694](https://github.com/open-chat-labs/open-chat/pull/4694))

### Changed

- Refund deposit if proposal fails to be submitted ([#4676](https://github.com/open-chat-labs/open-chat/pull/4676))
- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))

## [[2.0.916](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.916-proposals_bot)] - 2023-10-30

### Fixed

- Fix dissolve delay on neurons for submitting proposals ([#4668](https://github.com/open-chat-labs/open-chat/pull/4668))
- Refund the user whose proposal submission failed due to a bug ([#4669](https://github.com/open-chat-labs/open-chat/pull/4669))

## [[2.0.915](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.915-proposals_bot)] - 2023-10-27

### Changed

- Retry sending proposal messages which originally failed ([#4663](https://github.com/open-chat-labs/open-chat/pull/4663))

## [[2.0.911](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.911-proposals_bot)] - 2023-10-27

### Added

- Add `permissions_v2` when creating group ([#4620](https://github.com/open-chat-labs/open-chat/pull/4620))

### Fixed

- Fix Kinic's `ledger_canister_id` whose lookup originally failed ([#4633](https://github.com/open-chat-labs/open-chat/pull/4633))

## [[2.0.903](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.903-proposals_bot)] - 2023-10-20

### Added

- Support staking a neuron for any SNS to then use to submit proposals ([#4631](https://github.com/open-chat-labs/open-chat/pull/4631))
- Add `permissions_v2` when creating group ([#4620](https://github.com/open-chat-labs/open-chat/pull/4620))

## [[2.0.891](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.891-proposals_bot)] - 2023-10-19

### Added

- Support submitting proposals to any governance canister ([#4579](https://github.com/open-chat-labs/open-chat/pull/4579))

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

## [[2.0.884](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.884-proposals_bot)] - 2023-10-12

### Added

- Store whether submitting proposals is enabled or not in the Registry ([#4564](https://github.com/open-chat-labs/open-chat/pull/4564))

### Changed

- Retry submitting proposal if looking up user fails ([#4543](https://github.com/open-chat-labs/open-chat/pull/4543))
- Store `ledger_canister_id` along with each `NervousSystem` ([#4551](https://github.com/open-chat-labs/open-chat/pull/4551))
- Get nervous system updates from the Registry ([#4557](https://github.com/open-chat-labs/open-chat/pull/4557))

## [[2.0.881](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.881-proposals_bot)] - 2023-10-10

### Changed

- Add logging around submitting proposals ([#4538](https://github.com/open-chat-labs/open-chat/pull/4538))

## [[2.0.879](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.879-proposals_bot)] - 2023-10-09

### Added

- Automatically create proposals groups for new SNSes ([#4528](https://github.com/open-chat-labs/open-chat/pull/4528))

### Removed

- Remove `add_governance_canister` since it is now automated ([#4532](https://github.com/open-chat-labs/open-chat/pull/4532))

## [[2.0.876](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.876-proposals_bot)] - 2023-10-09

### Added

- Support submitting proposals from within OpenChat ([#4486](https://github.com/open-chat-labs/open-chat/pull/4486))
- Make ProposalsBot able to stake neurons for submitting proposals ([#4493](https://github.com/open-chat-labs/open-chat/pull/4493))

### Changed

- Use canister timer rather than heartbeat to retrieve proposals ([#4504](https://github.com/open-chat-labs/open-chat/pull/4504))
- Use canister timer rather than heartbeat to push proposals ([#4506](https://github.com/open-chat-labs/open-chat/pull/4506))
- Use canister timer rather than heartbeat to update proposals ([#4507](https://github.com/open-chat-labs/open-chat/pull/4507))
- Refund deposit if user submitted proposal is successful ([#4509](https://github.com/open-chat-labs/open-chat/pull/4509))
- Top up neuron if user submitted proposal is rejected ([#4510](https://github.com/open-chat-labs/open-chat/pull/4510))
- Add 'Submitted by @Username on OpenChat' suffix to proposals ([#4511](https://github.com/open-chat-labs/open-chat/pull/4511))

## [[2.0.843](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.843-proposals_bot)] - 2023-09-11

### Changed

- Mark proposal message as successfully sent if messageId already in use ([#4344](https://github.com/open-chat-labs/open-chat/pull/4344))

### Fixed

- Temp hack to fix the Dragginz Proposalz channel ([#4349](https://github.com/open-chat-labs/open-chat/pull/4349))

## [[2.0.806](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.806-proposals_bot)] - 2023-08-11

### Changed

- Add support for versioned access rules ([#4159](https://github.com/open-chat-labs/open-chat/pull/4159))

## [[2.0.796](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.796-proposals_bot)] - 2023-08-08

### Changed

- Display the `community_id` in `add_governance_canister` proposals ([#4121](https://github.com/open-chat-labs/open-chat/pull/4121))

## [[2.0.777](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.777-proposals_bot)] - 2023-08-01

### Added

- Finish implementing `import_proposals_group_into_community` ([#4089](https://github.com/open-chat-labs/open-chat/pull/4089))

### Removed

- Drop `name` from nervous systems since it is unused ([#4011](https://github.com/open-chat-labs/open-chat/pull/4011))

## [[2.0.755](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.755-proposals_bot)] - 2023-07-20

### Changed

- Remove dependency on `ic-sns-governance` ([#3965](https://github.com/open-chat-labs/open-chat/pull/3965))

## [[2.0.737](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.737-proposals_bot)] - 2023-07-03

### Changed

- Update status of finished proposals ([#3890](https://github.com/open-chat-labs/open-chat/pull/3890))

## [[2.0.728](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.728-proposals_bot)] - 2023-06-27

### Added

- Add support for channels to proposals_bot ([#3832](https://github.com/open-chat-labs/open-chat/pull/3832))
- Implement `import_proposals_group_into_community` ([#3844](https://github.com/open-chat-labs/open-chat/pull/3844))

## [[2.0.711](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.711-proposals_bot)] - 2023-06-01

### Changed

- Switch over to using `send_message_v2` ([#3603](https://github.com/open-chat-labs/open-chat/pull/3603))

## [[2.0.658](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.658-proposals_bot)] - 2023-04-14

### Changed

- Only retrieve active proposals ([#3369](https://github.com/open-chat-labs/open-chat/pull/3369))

## [[2.0.647](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.647-proposals_bot)] - 2023-03-24

### Fixed

- Call group::change_role using candid ([#3340](https://github.com/open-chat-labs/open-chat/pull/3340))

## [[2.0.638](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.638-proposals_bot)] - 2023-03-20

### Added

- Added appoint_admins endpoint callable by proposal ([#3327](https://github.com/open-chat-labs/open-chat/pull/3327))

### Removed

- Removed update_group_details endpoint callable by platform operators ([#3325](https://github.com/open-chat-labs/open-chat/pull/3325))

## [[2.0.637](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.637-proposals_bot)] - 2023-03-17

### Added

- Added missing proposal validation functions ([#3298](https://github.com/open-chat-labs/open-chat/pull/3298))
- Added update_group_details endpoint callable by platform operators ([#3308](https://github.com/open-chat-labs/open-chat/pull/3308))

### Removed

- Removed temp hack only needed for previous upgrade ([#3293](https://github.com/open-chat-labs/open-chat/pull/3293))
- Removed `set_governance_principals` ([#3301](https://github.com/open-chat-labs/open-chat/pull/3301))

## [[2.0.631](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.631-proposals_bot)] - 2023-03-10

### Fixed

- Temp hack to fix error due to duplicate MessageIds ([#3292](https://github.com/open-chat-labs/open-chat/pull/3292))

## [[2.0.627](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.627-proposals_bot)] - 2023-03-09

### Removed

- Removed code only needed for previous upgrade ([#3248](https://github.com/open-chat-labs/open-chat/pull/3248))
- Removed one time code to get payloads for OpenChat proposals ([#3278](https://github.com/open-chat-labs/open-chat/pull/3278))

### Fixed

- Fixed retrieval of SNS proposals ([#3277](https://github.com/open-chat-labs/open-chat/pull/3277))

## [[2.0.621](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.621-proposals_bot)] - 2023-03-01

### Added

- Added `payload_text_rendering` to SNS proposals ([#3175](https://github.com/open-chat-labs/open-chat/pull/3175))
- One time job to add payloads for existing OpenChat proposal messages ([#3224](https://github.com/open-chat-labs/open-chat/pull/3224))

## [[2.0.600](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.600-proposals_bot)] - 2023-02-17

### Changed

- Deserialize using `MemoryManager` within `post_upgrade` ([#3046](https://github.com/open-chat-labs/open-chat/pull/3046))
- Use `raw_rand` to seed rng ([#3076](https://github.com/open-chat-labs/open-chat/pull/3076))
- Update cdk to v0.7.0 ([#3115](https://github.com/open-chat-labs/open-chat/pull/3115))
- Rename service_principals -> governance_principals ([#3133](https://github.com/open-chat-labs/open-chat/pull/3133))

## [[2.0.576](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.576-proposals_bot)] - 2023-02-01

### Added

- Added `set_service_principals` for setting which principals have admin control ([#3038](https://github.com/open-chat-labs/open-chat/pull/3038))

### Changed

- Use `MemoryManager` so that we can use stable memory at run time ([#3040](https://github.com/open-chat-labs/open-chat/pull/3040))

### Removed

- Removed code only needed for the previous upgrade ([#3003](https://github.com/open-chat-labs/open-chat/pull/3003))

## [[2.0.562](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.562-proposals_bot)] - 2023-01-23

### Added

- Add `inspect_message` to proposals bot ([#2969](https://github.com/open-chat-labs/open-chat/pull/2969))

### Changed

- Use `canister_logger` and `canister_tracing_macros` from [ic-utils](https://github.com/open-chat-labs/ic-utils) ([#2985](https://github.com/open-chat-labs/open-chat/pull/2985))
