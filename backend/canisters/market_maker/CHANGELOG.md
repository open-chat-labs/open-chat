# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.900](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.900-market_maker)] - 2023-10-20

### Changed

- Adjust `MemoryManager` bucket size ([#4601](https://github.com/open-chat-labs/open-chat/pull/4601))

## [[2.0.862](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.862-market_maker)] - 2023-09-26

### Changed

- Split ICDex client code into its own library ([#4318](https://github.com/open-chat-labs/open-chat/pull/4318))
- Make `icdex_client` generic to work with any token pair ([#4324](https://github.com/open-chat-labs/open-chat/pull/4324))

## [[2.0.780](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.780-market_maker)] - 2023-08-01

### Changed

- Transfer exact amount of ICP per trade to avoid partial refund ([#4039](https://github.com/open-chat-labs/open-chat/pull/4039))
- Better handling of when an order is accepted ([#4045](https://github.com/open-chat-labs/open-chat/pull/4045))
- New and improved market maker algorithm ([#4063](https://github.com/open-chat-labs/open-chat/pull/4063))

## [[2.0.753](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.753-market_maker)] - 2023-07-20

### Changed

- Remove dependencies on IC repo ([#3970](https://github.com/open-chat-labs/open-chat/pull/3970))

## [[2.0.706](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.706-market_maker)] - 2023-06-01

### Changed

- Place orders furthest from the latest price first ([#3422](https://github.com/open-chat-labs/open-chat/pull/3422))
- Ensure only a single market maker job is ever running per exchange ([#3693](https://github.com/open-chat-labs/open-chat/pull/3693))
- Sum up existing orders when calculating new orders to make ([#3696](https://github.com/open-chat-labs/open-chat/pull/3696))
