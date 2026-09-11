# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add the DailyPuzzle canister: generates the day's puzzle, holds a vetoable candidate pool, pushes puzzles to local user indexes and indexes solve results
- Key puzzles, candidates and results by game id, schedule a game per weekday, add per-game configs (`set_game_config`, `game_configs`) and serve today's set via `current_puzzles` / `c2c_pull_puzzles`
- Add `regenerate_today` so governance can replace today's puzzle, optionally forcing a game
- Bound every configured CHIT amount (`entry_fee`, `reward_by_streak`, `hint_penalty`, `hint_prices`) against the user canister's own per-event limit, so a proposal cannot set a fee no one can pay or a reward that is refused after the solve is recorded
- Require `hint_prices` to strictly increase, since an upgrade is priced at the difference between the levels and a flat or descending table prices the jump to the conclusions at nothing
- Cap a candidate pool at 32, so repeated vetoes cannot grow it past the range of the `u8` index a veto addresses it by
- Add `inspect_message`, so anonymous ingress cannot reach the updates whose caller check makes an outbound registry call
- Push the day's puzzles to every local user index at once rather than one after another, so one stopped index no longer delays every index behind it
