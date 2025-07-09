# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1830](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1830-notification_pusher)] - 2025-07-09

### Changed

- Re-enabled fcm_data ([8298](https://github.com/open-chat-labs/open-chat/pull/8298))

## [[2.0.1819](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1819-notification_pusher)] - 2025-07-02

### Changed

- Serialize bot notifications in LUI not pusher ([#8169](https://github.com/open-chat-labs/open-chat/pull/8169))

## [[2.0.1789](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1789-notifications_pusher)] - 2025-06-13

### Added

- Updated the way configuration is loaded for the pusher by using the `envconf` crate ([8145](https://github.com/open-chat-labs/open-chat/pull/8145))
- If FCM token is present, notifications are also pushed to the native platforms via Firebase ([8229](https://github.com/open-chat-labs/open-chat/pull/8229))

### Changed

- Read notification canisters from NotificationsIndex ([#8091](https://github.com/open-chat-labs/open-chat/pull/8091))
- Add new bot lifecycle event ([#8163](https://github.com/open-chat-labs/open-chat/pull/8163))

## [[2.0.1775](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1775-notifications_pusher)] - 2025-06-02

### Changed

- Include application/json header for bot notifications when applicable ([#8068](https://github.com/open-chat-labs/open-chat/pull/8068))

## [[2.0.1765](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1765-notifications_pusher)] - 2025-05-28

### Added

- Implement pushing notifications to bots ([#7857](https://github.com/open-chat-labs/open-chat/pull/7857))

### Changed

- Split user notifications into separate module ([#7851](https://github.com/open-chat-labs/open-chat/pull/7851))
- Support autonomous bots without API keys ([#7985](https://github.com/open-chat-labs/open-chat/pull/7985))
- Support DNS resolution of `canister_id.localhost` ([#8029](https://github.com/open-chat-labs/open-chat/pull/8029))

## [[2.0.1610](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1610-notifications_pusher)] - 2024-02-27

### Added

- Record notification pusher metrics using Prometheus ([#7434](https://github.com/open-chat-labs/open-chat/pull/7434))

### Changed

- Throttle notifications to a subscription after any failures ([#6014](https://github.com/open-chat-labs/open-chat/pull/6014))
- Handle case where notifications pusher queue becomes full ([#7150](https://github.com/open-chat-labs/open-chat/pull/7150))
- Move notification processing to single synchronous thread + more metrics ([#7437](https://github.com/open-chat-labs/open-chat/pull/7437))
- Allow configuring the number of notification pusher threads ([#7438](https://github.com/open-chat-labs/open-chat/pull/7438))
- Use histograms to track notification latency and internal latency ([#7440](https://github.com/open-chat-labs/open-chat/pull/7440))
- Add metrics to measure durations to process and push notifications ([#7442](https://github.com/open-chat-labs/open-chat/pull/7442))
- Add `notification_payload_sizes` metric ([#7447](https://github.com/open-chat-labs/open-chat/pull/7447))

## [[2.0.1023](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1023-notifications_pusher)] - 2024-01-24

### Changed

- Increase the number of notification pusher threads ([#5237](https://github.com/open-chat-labs/open-chat/pull/5237))
- Store map of invalid subscription endpoints and skip pushing to them ([#5238](https://github.com/open-chat-labs/open-chat/pull/5238))
- Skip reading more notifications if queue is full ([#5240](https://github.com/open-chat-labs/open-chat/pull/5240))
- Reduce time between each query to get new notifications ([#5241](https://github.com/open-chat-labs/open-chat/pull/5241))

## [[2.0.970](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.970-notifications_pusher)] - 2023-12-12

### Changed

- Reduce `MAX_PAYLOAD_LENGTH_BYTES` for notifications ([#4021](https://github.com/open-chat-labs/open-chat/pull/4021))

## [[2.0.654](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.654-notifications_pusher)] - 2023-03-29

### Added

- Added `sub` claim to push notification Vapid signatures ([#3387](https://github.com/open-chat-labs/open-chat/pull/3387))
- Added `Urgency: high` header to notifications ([#3392](https://github.com/open-chat-labs/open-chat/pull/3392))

### Changed

- Set web push notification TTL to 1 hour ([#3386](https://github.com/open-chat-labs/open-chat/pull/3386))
- Clean up how `Urgency` header is added ([#3393](https://github.com/open-chat-labs/open-chat/pull/3393))
- Clean up code + small performance improvements ([#3394](https://github.com/open-chat-labs/open-chat/pull/3394))
