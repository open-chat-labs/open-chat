# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

## [[2.0.1028](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1028-neuron_controller)] - 2024-01-25

### Changed

- Add `spawning_neurons` to metrics ([#5206](https://github.com/open-chat-labs/open-chat/pull/5206))
- Avoid usages of `make_c2c_call` and use macro instead ([#5252](https://github.com/open-chat-labs/open-chat/pull/5252))

## [[2.0.1004](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1004-neuron_controller)] - 2024-01-11

### Changed

- Separate spawning neurons from active neurons ([#5159](https://github.com/open-chat-labs/open-chat/pull/5159))
- Refresh neurons after spawning or disbursing ([#5160](https://github.com/open-chat-labs/open-chat/pull/5160))
- Disburse all ICP now that system has been proven to work ([#5165](https://github.com/open-chat-labs/open-chat/pull/5165))

## [[2.0.1002](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.1002-neuron_controller)] - 2024-01-10

### Changed

- Split active neurons from disbursed neurons in metrics ([#5139](https://github.com/open-chat-labs/open-chat/pull/5139))

### Fixed

- Skip neurons that are spawning when detecting neurons to spawn from ([#5146](https://github.com/open-chat-labs/open-chat/pull/5146))

## [[2.0.995](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.995-neuron_controller)] - 2024-01-05

### Changed

- Disburse to CyclesDispenser if it is low otherwise send to treasury ([#5110](https://github.com/open-chat-labs/open-chat/pull/5110))
- Better formatting of proposal payloads ([#5115](https://github.com/open-chat-labs/open-chat/pull/5115))

## [[2.0.994](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.994-neuron_controller)] - 2024-01-03

### Added

- One time job to transfer ICP from NeuronController to OpenChat treasury ([#5106](https://github.com/open-chat-labs/open-chat/pull/5106))

### Changed

- Only disburse 1 ICP rather than full amount until we've seen it working ([#5103](https://github.com/open-chat-labs/open-chat/pull/5103))
- Extract code for making inter-canister calls via tECDSA ([#5105](https://github.com/open-chat-labs/open-chat/pull/5105))

## [[2.0.993](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.993-neuron_controller)] - 2024-01-03

### Added

- Automatically spawn neurons then disburse into the treasury ([#5097](https://github.com/open-chat-labs/open-chat/pull/5097))

## [[2.0.939](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.939-neuron_controller)] - 2023-11-23

### Added

- Expose full neuron data for neurons controlled by NeuronController ([#4811](https://github.com/open-chat-labs/open-chat/pull/4811))

### Changed

- Regenerate random number generator seed across upgrades ([#4814](https://github.com/open-chat-labs/open-chat/pull/4814))

## [[2.0.938](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.938-neuron_controller)] - 2023-11-17

### Added

- Add NeuronController canister ([#4772](https://github.com/open-chat-labs/open-chat/pull/4772))

### Changed

- Set `governance_principals` to only contain the SNS governance canister ([#4800](https://github.com/open-chat-labs/open-chat/pull/4800))
