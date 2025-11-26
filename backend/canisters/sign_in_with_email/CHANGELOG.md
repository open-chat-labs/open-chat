# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[0.14.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.14.0)] - 2025-11-25

### Added

- Add `get_principal endpoint` ([#54](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/54))

## [[0.13.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.13.0)] - 2024-09-02

### Changed

- Bump Rust to 1.80.0 ([#50](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/50))
- Bump CDK, DFX and PocketIC to latest versions ([#51](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/51))

## [[0.12.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.12.0)] - 2024-07-08

### Fixed

- Fix code check not being performed in all scenarios ([#48](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/48))

## [[0.11.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.11.0)] - 2024-07-02

### Changed

- Simplify magic link generation + include email in signature ([#45](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/45))

## [[0.10.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.10.0)] - 2024-06-06

### Changed

- Introduce a 3-digit code to magic link ([#42](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/42))

## [[0.9.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.9.0)] - 2024-05-23

### Added

- Add an explicit endpoint for handling magic links ([#33](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/33))
- Add `test_utils::generate_magic_link` to simplify tests ([#38](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/38))

### Changed

- Remove dependency on `dfx-core` ([#37](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/37))

### Fixed

- Fix template updater lambda function ([#36](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/36))

## [[0.7.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.7.0)] - 2024-05-09

### Changed

- Exit early if Docker build fails ([#31](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/31))

## [[0.6.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.6.0)] - 2024-05-08

### Added

- Add `email_sender_config` query endpoint ([#28](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/28))
- Display outcome after clicking on magic link ([#29](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/29))

## [[0.5.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.5.0)] - 2024-05-07

### Added

- Add `canister_upgrader` to simplify upgrading the canister ([#23](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/23))
- Add AWS Lambda gateway function to support IPv6 ([#24](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/24))

### Changed

- Start collecting basic stats per account ([#10](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/10))
- Pass up session key when generating verification code ([#12](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/12))
- Allow specifying the RNG salt for tests ([#14](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/14))
- Use magic links rather than verification codes ([#13](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/13))
- Keep track of active magic links ([#16](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/16))
- Include `identity_canister_id` when pushing magic links ([#19](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/19))
- Move `EmailSenderConfig` into `api` package so that it is public ([#22](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/22))
- Bump Rust version to 1.78.0 ([#25](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/25))
- Transform HTTP response to only return the status code ([#26](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/26))

## [[0.4.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.4.0)] - 2024-04-19

### Changed

- Avoid storing any email addresses ([#6](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/6))
- Return `blocked_duration` rather than `blocked_until` ([#7](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/7))

### Fixed

- Remove verification code after successful attempt ([#8](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/8))

## [[0.3.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.3.0)] - 2024-04-19

### Changed

- Introduce `ValidatedEmail` type to force validation in all cases ([#3](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/3))
- Mark codes with any failed attempts as failed when removed ([#4](https://github.com/open-chat-labs/ic-sign-in-with-email/pull/4))

## [[0.2.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.2.0)] - 2024-04-17

### Added

- Add email verification

### Changed

- Generate verification codes with 6 digits

## [[0.1.0](https://github.com/open-chat-labs/ic-sign-in-with-email/releases/tag/v0.1.0)] - 2024-04-15

- Initial release
