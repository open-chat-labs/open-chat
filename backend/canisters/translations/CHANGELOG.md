# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1067](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1067-translations)] - 2024-02-16

### Fixed

- Specify `created_at_time` in nanoseconds rather than milliseconds ([#5391](https://github.com/open-chat-labs/open-chat/pull/5391))

## [[2.0.1066](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1066-translations)] - 2024-02-16

### Fixed

- Resend translation payments which failed due to being too old ([#5388](https://github.com/open-chat-labs/open-chat/pull/5388))

## [[2.0.1064](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1064-translations)] - 2024-02-05

### Fixed

- Start job to make pending payments each time a payment is added ([#5379](https://github.com/open-chat-labs/open-chat/pull/5379))
- Trim proposed translations ([#5381](https://github.com/open-chat-labs/open-chat/pull/5381))

## [[2.0.1045](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1045-translations)] - 2024-02-05

### Added

- Implement translations API ([#5299](https://github.com/open-chat-labs/open-chat/pull/5299))
- Send periodic OC bot messages to translators ([#5318](https://github.com/open-chat-labs/open-chat/pull/5318))

### Changed

- Only pay user once for translating a given record ([#5312](https://github.com/open-chat-labs/open-chat/pull/5312))
- Simplify translations impl ([#5315](https://github.com/open-chat-labs/open-chat/pull/5315))