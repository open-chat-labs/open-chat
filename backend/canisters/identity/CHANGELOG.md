# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add an error log with http endpoint ([#6608](https://github.com/open-chat-labs/open-chat/pull/6608))

## [[2.0.1381](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1381-identity)] - 2024-10-11

### Changed

- Switch from using `canister_sig_util` to `ic-canister-sig-creation` ([#6537](https://github.com/open-chat-labs/open-chat/pull/6537))

### Fixed

- Add missing principal links to the 2 way mapping ([#6562](https://github.com/open-chat-labs/open-chat/pull/6562))

## [[2.0.1373](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1373-identity)] - 2024-10-07

### Changed

- Increase max stable memory read / write buffer size ([#6440](https://github.com/open-chat-labs/open-chat/pull/6440))
- Extract certificate handling code into `identity_utils` ([#6459](https://github.com/open-chat-labs/open-chat/pull/6459))
- Add serde default attribute in preparation for skipping serialization if default ([#6475](https://github.com/open-chat-labs/open-chat/pull/6475))
- Run check to ensure auth principal <-> user principal maps are in sync ([#6512](https://github.com/open-chat-labs/open-chat/pull/6512))

## [[2.0.1344](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1344-identity)] - 2024-09-10

### Fixed

- Use the mainnet II canister Id rather than the one used in local testing ([#6363](https://github.com/open-chat-labs/open-chat/pull/6363))

## [[2.0.1340](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1340-identity)] - 2024-09-10

### Changed

- Set `is_ii_principal` field to true where that is known to be the case ([#6326](https://github.com/open-chat-labs/open-chat/pull/6326))

## [[2.0.1330](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1330-identity)] - 2024-09-05

### Changed

- Serialize large integers as strings when using MessagePack ([#6315](https://github.com/open-chat-labs/open-chat/pull/6315))
- Flag which authentication principals are II principals ([#6321](https://github.com/open-chat-labs/open-chat/pull/6321))

## [[2.0.1311](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1311-identity)] - 2024-08-30

### Changed

- Support deserializing u128 and i128 values from strings ([#6259](https://github.com/open-chat-labs/open-chat/pull/6259))

### Fixed

- Allow linking existing identities which have not registered as OC users ([#6292](https://github.com/open-chat-labs/open-chat/pull/6292))

## [[2.0.1289](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1289-identity)] - 2024-08-13

### Added

- Add `user_principals` showing current user's principals per auth provider ([#6205](https://github.com/open-chat-labs/open-chat/pull/6205))

### Changed

- Add `AlreadyLinkedToPrincipal` to `initiate_identity_link` response ([#6204](https://github.com/open-chat-labs/open-chat/pull/6204))
- Rename `user_principals` to `auth_principals` ([#6206](https://github.com/open-chat-labs/open-chat/pull/6206))

### Fixed

- Add new principal to `auth_principals` list after linking ([#6207](https://github.com/open-chat-labs/open-chat/pull/6207))
- Only return `AlreadyRegistered` if identity is linked to an OC account ([#6208](https://github.com/open-chat-labs/open-chat/pull/6208))

## [[2.0.1251](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1251-identity)] - 2024-07-25

### Changed

- Only allow identities from approved originating canisters ([#6060](https://github.com/open-chat-labs/open-chat/pull/6060))

## [[2.0.1239](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1239-identity)] - 2024-07-17

### Added

- Sync userIds to Identity canister ([#6027](https://github.com/open-chat-labs/open-chat/pull/6027))
- Support linking multiple auth principals to an OC account ([#5852](https://github.com/open-chat-labs/open-chat/pull/5852))

## [[2.0.1209](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1209-identity)] - 2024-06-20

### Changed

- Require challenge for sign-in by ETH or SOL ([#5952](https://github.com/open-chat-labs/open-chat/pull/5952))

## [[2.0.1207](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1207-identity)] - 2024-06-19

### Changed

- Remove `principal` from `create_identity` response ([#5849](https://github.com/open-chat-labs/open-chat/pull/5849))
- Expose count of auth principals per originating canister in metrics ([#5851](https://github.com/open-chat-labs/open-chat/pull/5851))
- Require challenge for sign-in by ETH or SOL ([#5941](https://github.com/open-chat-labs/open-chat/pull/5941))

## [[2.0.1177](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1177-identity)] - 2024-05-23

### Changed

- Skip captcha for SIWE and SIWS ([#5812](https://github.com/open-chat-labs/open-chat/pull/5812))

## [[2.0.1176](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1176-identity)] - 2024-05-16

### Removed

- Remove code to update user principals ([#5808](https://github.com/open-chat-labs/open-chat/pull/5808))

### Fixed

- Fix principals that were incorrectly migrated multiple times ([#5809](https://github.com/open-chat-labs/open-chat/pull/5809))

## [[2.0.1161](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1161-identity)] - 2024-05-02

### Fixed

- Fix handling of error case when migrating user principal ([#5757](https://github.com/open-chat-labs/open-chat/pull/5757))

## [[2.0.1159](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1159-identity)] - 2024-05-01

### Changed

- Prevent users from creating new identities from legacy principals ([#5751](https://github.com/open-chat-labs/open-chat/pull/5751))

### Fixed

- Retry principal migration if it failed first time ([#5755](https://github.com/open-chat-labs/open-chat/pull/5755))

## [[2.0.1155](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1155-identity)] - 2024-04-28

### Changed

- Add `user_principals` and `auth_principals` to metrics ([#5723](https://github.com/open-chat-labs/open-chat/pull/5723))

## [[2.0.1148](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1148-identity)] - 2024-04-23

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
