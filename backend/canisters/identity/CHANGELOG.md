# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Implement ability to update user principals ([#5220](https://github.com/open-chat-labs/open-chat/pull/5220))
- Sync user principals from the UserIndex canister ([#5264](https://github.com/open-chat-labs/open-chat/pull/5264))
- Implement `migrate_legacy_principal` ([#5274](https://github.com/open-chat-labs/open-chat/pull/5274))
- Expose count of `legacy_principals` in metrics ([#5311](https://github.com/open-chat-labs/open-chat/pull/5311))
- Implement ability to create key delegations for users ([#5328](https://github.com/open-chat-labs/open-chat/pull/5328))
- Add `create_identity` ([#5404](https://github.com/open-chat-labs/open-chat/pull/5404))
- Add job to migrate all principals to new system ([#5557](https://github.com/open-chat-labs/open-chat/pull/5557))

### Changed

- Fix low risk findings from Identity canister security review ([#5599](https://github.com/open-chat-labs/open-chat/pull/5599))
