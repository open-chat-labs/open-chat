# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Reduce message Ids to 64 bits down from 128 bits ([#7232](https://github.com/open-chat-labs/open-chat/pull/7232))
- Reduce channel Ids to 32 bits down from 128 bits ([#7233](https://github.com/open-chat-labs/open-chat/pull/7233))

### Removed

- Remove unused candid endpoints ([#7264](https://github.com/open-chat-labs/open-chat/pull/7264))

### Fixed

- Avoid retrying c2c call if recipient canister is uninstalled ([#7302](https://github.com/open-chat-labs/open-chat/pull/7302))

## [[2.0.1526](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1526-escrow)] - 2024-12-19

### Changed

- Disallow P2P swaps of disabled tokens ([#7057](https://github.com/open-chat-labs/open-chat/pull/7057))

## [[2.0.1512](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1512-escrow)] - 2024-12-13

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Make `ChannelId` comparisons use their 32bit representation ([#6885](https://github.com/open-chat-labs/open-chat/pull/6885))
- Expose size of each virtual stable memory in metrics ([#6981](https://github.com/open-chat-labs/open-chat/pull/6981))
- Include the ledger canister Id in transfer failed error logs ([#7011](https://github.com/open-chat-labs/open-chat/pull/7011))
- Expose transfer errors that occur during swaps ([#7055](https://github.com/open-chat-labs/open-chat/pull/7055))

## [[2.0.1316](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1316-escrow)] - 2024-09-02

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

## [[2.0.1252](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1252-escrow)] - 2024-07-25

### Changed

- Don't retry c2c calls after getting a `CanisterMethodNotFound` error ([#5747](https://github.com/open-chat-labs/open-chat/pull/5747))
- Fix fee then retry transfer if fee too high ([#6063](https://github.com/open-chat-labs/open-chat/pull/6063))
- Handle transfer fee changing in either direction ([#6064](https://github.com/open-chat-labs/open-chat/pull/6064))

## [[2.0.1158](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1158-escrow)] - 2024-05-01

### Changed

- Seed rng with entropy before calling `raw_rand` to get randomness ([#5454](https://github.com/open-chat-labs/open-chat/pull/5454))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))
- Don't retry c2c calls after getting a `DestinationInvalid` error ([#5732](https://github.com/open-chat-labs/open-chat/pull/5732))

## [[2.0.1063](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1063-escrow)] - 2024-02-15

### Changed

- Another attempt at refunding the failed SNEED transfers ([#5375](https://github.com/open-chat-labs/open-chat/pull/5375))

## [[2.0.1062](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1062-escrow)] - 2024-02-14

### Changed

- Refund 2 more failed SNEED p2p swaps ([#5359](https://github.com/open-chat-labs/open-chat/pull/5359))

## [[2.0.1050](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1050-escrow)] - 2024-02-08

### Changed

- Another attempt to refund SNEED from failed p2p swaps ([#5339](https://github.com/open-chat-labs/open-chat/pull/5339))

## [[2.0.1049](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1049-escrow)] - 2024-02-08

### Changed

- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))
- Hack to cater for SNEED's unique handling of transfer fees ([#5280](https://github.com/open-chat-labs/open-chat/pull/5280))
- Refund failed SNEED p2p swaps ([#5332](https://github.com/open-chat-labs/open-chat/pull/5332))

## [[2.0.1020](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1020-escrow)] - 2024-01-24

### Changed

- Include `created_by` on `SwapStatusChange` messages ([#5230](https://github.com/open-chat-labs/open-chat/pull/5230))
- Simplify timer jobs + make them more efficient ([#5233](https://github.com/open-chat-labs/open-chat/pull/5233))

## [[2.0.1014](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1014-escrow)] - 2024-01-19

### Added

- Introduce the Escrow canister for supporting p2p trades ([#4903](https://github.com/open-chat-labs/open-chat/pull/4903))
- Implement `create_offer` and `notify_deposit` ([#4904](https://github.com/open-chat-labs/open-chat/pull/4904))
- Transfer out funds once trade is complete ([#4906](https://github.com/open-chat-labs/open-chat/pull/4906))
- Implement `cancel_offer` ([#4907](https://github.com/open-chat-labs/open-chat/pull/4907))
- Support notifying a chosen canister when trade is completed ([#5167](https://github.com/open-chat-labs/open-chat/pull/5167))
- Notify user canisters when p2p swaps complete ([#5191](https://github.com/open-chat-labs/open-chat/pull/5191))
- Refund deposits if swap gets cancelled ([#5192](https://github.com/open-chat-labs/open-chat/pull/5192))
- Refund deposits if swap expires ([#5195](https://github.com/open-chat-labs/open-chat/pull/5195))
- Support `additional_admins` for p2p swaps ([#5204](https://github.com/open-chat-labs/open-chat/pull/5204))
- Expose count of swaps in metrics ([#5210](https://github.com/open-chat-labs/open-chat/pull/5210))

### Changed

- Rename input/output to token0/token1 ([#5174](https://github.com/open-chat-labs/open-chat/pull/5174))
- Use "swap" instead of "trade" in vars and types ([#5175](https://github.com/open-chat-labs/open-chat/pull/5175))
- Rename "offer" to "swap" ([#5187](https://github.com/open-chat-labs/open-chat/pull/5187))
