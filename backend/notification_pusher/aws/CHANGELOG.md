# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Throttle notifications to a subscription after any failures ([#6014](https://github.com/open-chat-labs/open-chat/pull/6014))
- Handle case where notifications pusher queue becomes full ([#7150](https://github.com/open-chat-labs/open-chat/pull/7150))
- Record notification pusher metrics using Prometheus ([#7434](https://github.com/open-chat-labs/open-chat/pull/7434))
- Move notification processing to single synchronous thread + more metrics ([#7437](https://github.com/open-chat-labs/open-chat/pull/7437))
- Allow configuring the number of notification pusher threads ([#7438](https://github.com/open-chat-labs/open-chat/pull/7438))
- Use histograms to track notification latency and internal latency ([#7440](https://github.com/open-chat-labs/open-chat/pull/7440))
- Add metrics to measure durations to process and push notifications ([#7442](https://github.com/open-chat-labs/open-chat/pull/7442))

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
