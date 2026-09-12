# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add the DailyPuzzle canister: generates the day's puzzle, holds a vetoable candidate pool, pushes puzzles to local user indexes and indexes solve results
- Key puzzles, candidates and results by game id, schedule a game per weekday, add per-game configs (`set_game_config`, `game_configs`) and serve today's set via `current_puzzles` / `c2c_pull_puzzles`
- Add `regenerate_today` so a platform operator can replace today's puzzle, optionally forcing a game
- Bound every configured CHIT amount (`entry_fee`, `reward_by_streak`, `hint_penalty`, `hint_prices`) against the user canister's own per-event limit, so a config change cannot set a fee no one can pay or a reward that is refused after the solve is recorded
- Require `hint_prices` to strictly increase, since an upgrade is priced at the difference between the levels and a flat or descending table prices the jump to the conclusions at nothing
- Cap a candidate pool at 32, so repeated vetoes cannot grow it past the range of the `u8` index a veto addresses it by
- Add `inspect_message`, so anonymous ingress cannot reach the updates whose caller check makes an outbound registry call
- Gate `candidates`, `push_now`, `regenerate_today`, `set_config`, `set_game_config`, `set_schedule` and `veto_candidate` on platform operator rather than governance principal, so the admin page drives them directly instead of each config change needing a proposal. `candidates` becomes an update, since the operator check is a call to the user index
- Drop `governance_principals` from the init args, since no endpoint is governance-gated any more. The SNS still controls the canister as its controller, so upgrades are unaffected
- Wire the canister up to the cycles dispenser, so it tops itself up rather than freezing silently with no puzzle shipped. It still needs adding to the dispenser's canister list by proposal, as every other canister does
- Add `max_free_checks` to the config, bounding the free outcomes of the local user index's hint call
- Ship one puzzle per day whatever the schedule now says for that day, so a mid-day `set_schedule` cannot leave two live puzzles and charge two entry fees. A schedule change takes effect from tomorrow; `regenerate_today` is what changes today
- Count `/metrics` results against the borrowed game id rather than cloning one per row
- Push the day's puzzles to every local user index at once rather than one after another, so one stopped index no longer delays every index behind it
