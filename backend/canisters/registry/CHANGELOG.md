# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- When a token is added, disable existing token with the same ticker ([#6392](https://github.com/open-chat-labs/open-chat/pull/6392))

### Removed

- Remove deprecated candid endpoints ([#6396](https://github.com/open-chat-labs/open-chat/pull/6396))

## [[2.0.1334](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1334-registry)] - 2024-09-06

### Added

- Expose MessagePack versions of Registry canister APIs ([#6318](https://github.com/open-chat-labs/open-chat/pull/6318))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))

## [[2.0.1323](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1323-registry)] - 2024-09-03

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1298](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1298-registry)] - 2024-08-19

### Changed

- Mark tokens as incompatible with ICRC1 if they have a non-zero burn fee ([#6143](https://github.com/open-chat-labs/open-chat/pull/6143))
- Check for transfer fee changes when refreshing token details ([#6252](https://github.com/open-chat-labs/open-chat/pull/6252))

## [[2.0.1250](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1250-registry)] - 2024-07-25

### Changed

- Simplify adding tokens and add compatibility with `burn_fee` ([#6102](https://github.com/open-chat-labs/open-chat/pull/6102))

## [[2.0.1193](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1193-registry)] - 2024-06-06

### Fixed

- Fix incorrect token logo Ids ([#5911](https://github.com/open-chat-labs/open-chat/pull/5911))

## [[2.0.1174](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1174-registry)] - 2024-05-14

### Changed

- Expose `enabled` field in the metrics for each token ([#5788](https://github.com/open-chat-labs/open-chat/pull/5788))
- Update circulating supply definition ([#5801](https://github.com/open-chat-labs/open-chat/pull/5801))

## [[2.0.1168](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1168-registry)] - 2024-05-08

### Changed

- Subtract Dfinity neurons which are still vesting from circulating supply ([#5783](https://github.com/open-chat-labs/open-chat/pull/5783))

## [[2.0.1167](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1167-registry)] - 2024-05-08

### Added

- Automatically update token names, symbols and logos ([#5780](https://github.com/open-chat-labs/open-chat/pull/5780))

### Changed

- Only allow tokens which are compatible with the ICRC1 standard ([#5733](https://github.com/open-chat-labs/open-chat/pull/5733))
- Update NAUT ledger canister ([#5779](https://github.com/open-chat-labs/open-chat/pull/5779))

## [[2.0.1166](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1166-registry)] - 2024-05-07

### Changed

- Return total and circulating supply amounts as CHATs rather than e8s ([#5773](https://github.com/open-chat-labs/open-chat/pull/5773))

## [[2.0.1165](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1165-registry)] - 2024-05-06

### Changed

- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))
- Calculate and expose total supply and circulating supply ([#5771](https://github.com/open-chat-labs/open-chat/pull/5771))

## [[2.0.1143](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1143-registry)] - 2024-04-19

### Changed

- Avoid returning `logo` if `logo_id` is set ([#5653](https://github.com/open-chat-labs/open-chat/pull/5653))

### Fixed

- Fix incorrect `min_dissolve_delay_to_vote` values ([#5701](https://github.com/open-chat-labs/open-chat/pull/5701))

## [[2.0.1122](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1122-registry)] - 2024-03-26

### Added

- Serve up token logos from the Registry canister ([#5592](https://github.com/open-chat-labs/open-chat/pull/5592))

## [[2.0.1102](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1102-registry)] - 2024-03-14

### Added

- Allow platform operators to disable sending/swapping of tokens ([#5533](https://github.com/open-chat-labs/open-chat/pull/5533))

### Fixed

- Update `last_updated` when `set_fee` is called ([#5544](https://github.com/open-chat-labs/open-chat/pull/5544))

## [[2.0.1101](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1101-registry)] - 2024-03-12

### Fixed

- Fix Dragginz transaction fee ([#5531](https://github.com/open-chat-labs/open-chat/pull/5531))

## [[2.0.1088](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1088-registry)] - 2024-03-07

### Changed

- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))
- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Use index rather than hash to look up ICP transactions ([#5485](https://github.com/open-chat-labs/open-chat/pull/5485))

## [[2.0.1005](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1005-registry)] - 2024-01-15

### Fixed

- Update Windoge98 transaction fee ([#5176](https://github.com/open-chat-labs/open-chat/pull/5176))

## [[2.0.1003](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1003-registry)] - 2024-01-10

### Changed

- Better formatting of proposal payloads ([#5115](https://github.com/open-chat-labs/open-chat/pull/5115))

### Fixed

- Get standards in parallel + get them for new token ([#5004](https://github.com/open-chat-labs/open-chat/pull/5004))
- Fix job to update supported token standards ([#5155](https://github.com/open-chat-labs/open-chat/pull/5155))

## [[2.0.972](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.972-registry)] - 2023-12-12

### Added

- Added support for message filters in registry ([#4984](https://github.com/open-chat-labs/open-chat/pull/4984))

## [[2.0.941](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.941-registry)] - 2023-10-30

### Changed

- Use dynamic buffer size when reading from stable memory ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Rename 'block_index' to 'transaction_index' ([#4683](https://github.com/open-chat-labs/open-chat/pull/4683))
- Avoid reseeding random number generator after each upgrade ([#4755](https://github.com/open-chat-labs/open-chat/pull/4755))
- Update dependencies ([#4770](https://github.com/open-chat-labs/open-chat/pull/4770))
- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))
- Sync `supported standards` from each token ledger ([#4827](https://github.com/open-chat-labs/open-chat/pull/4827))

## [[2.0.918](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.918-registry)] - 2023-10-30

### Added

- Implement job to update SNS metadata and parameters ([#4674](https://github.com/open-chat-labs/open-chat/pull/4674))

## [[2.0.904](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.904-registry)] - 2023-10-24

### Changed

- Added `index_canister_id` to `NervousSystemSummary` ([#4632](https://github.com/open-chat-labs/open-chat/pull/4632))

## [[2.0.892](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.892-registry)] - 2023-10-19

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

### Fixed

- Set `last_updated` after updating token details ([#4596](https://github.com/open-chat-labs/open-chat/pull/4596))

## [[2.0.885](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.885-registry)] - 2023-10-13

### Changed

- Include `root_canister_id` in `NervousSystemSummary` ([#4573](https://github.com/open-chat-labs/open-chat/pull/4573))

### Removed

- Remove deprecated `nervous_system` field from `TokenDetails` ([#4584](https://github.com/open-chat-labs/open-chat/pull/4584))

## [[2.0.883](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.883-registry)] - 2023-10-12

### Added

- Added `c2c_nervous_systems` ([#4557](https://github.com/open-chat-labs/open-chat/pull/4557))
- Store whether submitting proposals is enabled or not in the Registry ([#4564](https://github.com/open-chat-labs/open-chat/pull/4564))
- Return nervous system details when polling the Registry ([#4565](https://github.com/open-chat-labs/open-chat/pull/4565))

### Changed

- Add `name` and `symbol` to rendering of 'Update token' proposals ([#4167](https://github.com/open-chat-labs/open-chat/pull/4167))
- Store nervous system details in the Registry ([#4555](https://github.com/open-chat-labs/open-chat/pull/4555))

## [[2.0.797](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.797-registry)] - 2023-08-08

### Added

- Automate adding SNS tokens to the registry ([#4124](https://github.com/open-chat-labs/open-chat/pull/4124))

### Changed

- Store root and governance canisters for SNS tokens ([#4001](https://github.com/open-chat-labs/open-chat/pull/4001))
- Rename `sns_canisters` to `nervous_system` ([#4012](https://github.com/open-chat-labs/open-chat/pull/4012))
- Add ICP token details to registry upon init ([#4013](https://github.com/open-chat-labs/open-chat/pull/4013))
- Support updating token name and symbol ([#4128](https://github.com/open-chat-labs/open-chat/pull/4128))

## [[2.0.756](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.756-registry)] - 2023-07-20

### Changed

- Remove dependencies on IC repo ([#3970](https://github.com/open-chat-labs/open-chat/pull/3970))

## [[2.0.739](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.739-registry)] - 2023-07-06

### Changed

- Fetch token logo when adding token to registry ([#3917](https://github.com/open-chat-labs/open-chat/pull/3917))
- Implement `update_token` ([#3921](https://github.com/open-chat-labs/open-chat/pull/3921))
- Give option to manually specify logo in `add_token` ([#3921](https://github.com/open-chat-labs/open-chat/pull/3921))
