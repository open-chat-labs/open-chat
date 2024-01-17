# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Introduce the Escrow canister for supporting p2p trades ([#4903](https://github.com/open-chat-labs/open-chat/pull/4903))
- Implement `create_offer` and `notify_deposit` ([#4904](https://github.com/open-chat-labs/open-chat/pull/4904)) 
- Transfer out funds once trade is complete ([#4906](https://github.com/open-chat-labs/open-chat/pull/4906))
- Implement `cancel_offer` ([#4907](https://github.com/open-chat-labs/open-chat/pull/4907))
- Support notifying a chosen canister when trade is completed ([#5167](https://github.com/open-chat-labs/open-chat/pull/5167))
- Notify user canisters when p2p swaps complete ([#5191](https://github.com/open-chat-labs/open-chat/pull/5191))
- Refund deposits if swap gets cancelled ([#5192](https://github.com/open-chat-labs/open-chat/pull/5192))

### Changed

- Rename input/output to token0/token1 ([#5174](https://github.com/open-chat-labs/open-chat/pull/5174))
- Use "swap" instead of "trade" in vars and types ([#5175](https://github.com/open-chat-labs/open-chat/pull/5175))
- Rename "offer" to "swap" ([#5187](https://github.com/open-chat-labs/open-chat/pull/5187))
