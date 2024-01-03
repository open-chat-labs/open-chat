# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Only disburse 1 ICP rather than full amount until we've seen it working ([#5103](https://github.com/open-chat-labs/open-chat/pull/5103))

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
