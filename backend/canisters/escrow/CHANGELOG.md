# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

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
