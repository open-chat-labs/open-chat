# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Skip Captcha for SignInWithEmail identities ([#5692](https://github.com/open-chat-labs/open-chat/pull/5692))
- Expose both heap and stable memory in metrics ([#5718](https://github.com/open-chat-labs/open-chat/pull/5718))

## [[2.0.1133](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1133-identity)] - 2024-04-09

### Changed

- Re-sync principals to Identity canister but excluding bot users ([#5650](https://github.com/open-chat-labs/open-chat/pull/5650))

## [[2.0.1130](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1130-identity)] - 2024-04-05

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))
- Sync user principals from the UserIndex canister ([#5264](https://github.com/open-chat-labs/open-chat/pull/5264))
- Implement `migrate_legacy_principal` ([#5274](https://github.com/open-chat-labs/open-chat/pull/5274))
- Expose count of `legacy_principals` in metrics ([#5311](https://github.com/open-chat-labs/open-chat/pull/5311))
- Implement ability to create key delegations for users ([#5328](https://github.com/open-chat-labs/open-chat/pull/5328))
- Add `create_identity` ([#5404](https://github.com/open-chat-labs/open-chat/pull/5404))
- Add job to migrate all principals to new system ([#5557](https://github.com/open-chat-labs/open-chat/pull/5557))
- Require a CAPTCHA for identities which don't originate from II canister ([#5626](https://github.com/open-chat-labs/open-chat/pull/5626))

### Changed

- Fix low risk findings from Identity canister security review ([#5599](https://github.com/open-chat-labs/open-chat/pull/5599))
