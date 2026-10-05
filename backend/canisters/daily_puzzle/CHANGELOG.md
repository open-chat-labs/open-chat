# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Changed

- Run the repeating jobs on `PerRoundTimer` rather than `set_timer_interval` ([#9772](https://github.com/open-chat-labs/open-chat/pull/9772))

## [[2.0.2093](https://github.com/open-chat-labs/open-chat/releases/tag/v2.0.2093-daily_puzzle)] - 2026-10-05

### Added

- Add the DailyPuzzle canister: generates the day's puzzle, holds a vetoable candidate pool, pushes puzzles to local user indexes and indexes solve results ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Key puzzles, candidates and results by game id, schedule a game per weekday, add per-game configs (`set_game_config`, `game_configs`) and serve today's set via `current_puzzles` / `c2c_pull_puzzles` ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Add `regenerate_today` so a platform operator can replace today's puzzle, optionally forcing a game ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Bound every configured CHIT amount (`entry_fee`, `reward_by_streak`, `hint_penalty`, `hint_prices`) against the user canister's own per-event limit, so a config change cannot set a fee no one can pay or a reward that is refused after the solve is recorded ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Require `hint_prices` to strictly increase, since an upgrade is priced at the difference between the levels and a flat or descending table prices the jump to the conclusions at nothing ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Cap a candidate pool at 32, so repeated vetoes cannot grow it past the range of the `u8` index a veto addresses it by ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Add `inspect_message`, so anonymous ingress cannot reach the updates whose caller check makes an outbound registry call ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Gate `candidates`, `push_now`, `regenerate_today`, `set_config`, `set_game_config`, `set_schedule` and `veto_candidate` on platform operator rather than governance principal, so the admin page drives them directly instead of each config change needing a proposal. `candidates` becomes an update, since the operator check is a call to the user index ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Drop `governance_principals` from the init args, since no endpoint is governance-gated any more. The SNS still controls the canister as its controller, so upgrades are unaffected ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Wire the canister up to the cycles dispenser, so it tops itself up rather than freezing silently with no puzzle shipped. It still needs adding to the dispenser's canister list by proposal, as every other canister does ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Add `max_free_checks` to the config, bounding the free outcomes of the local user index's hint call ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Ship one puzzle per day whatever the schedule now says for that day, so a mid-day `set_schedule` cannot leave two live puzzles and charge two entry fees. A schedule change takes effect from tomorrow; `regenerate_today` is what changes today ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Count `/metrics` results against the borrowed game id rather than cloning one per row ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Push the day's puzzles to every local user index at once rather than one after another, so one stopped index no longer delays every index behind it ([#9345](https://github.com/open-chat-labs/open-chat/pull/9345))
- Move every price, reward, cap and the weekday rota into code, so a change to any of them is a reviewed release: `set_config` becomes `set_enabled`, and `set_game_config`, `set_schedule`, `schedule` and `game_configs` are removed. Puzzles held across an upgrade are restamped with the new build's numbers before the push ([#9359](https://github.com/open-chat-labs/open-chat/pull/9359))
- Add the CHAT Rooms generator, a Queens-style game: one CHAT per row, column and room, none touching, with at most one single-cell room. Always Tricky, 9x9 by default ([#9675](https://github.com/open-chat-labs/open-chat/pull/9675))

### Changed

- Track the spawned tasks in progress using `utils::async_work` ([#9546](https://github.com/open-chat-labs/open-chat/pull/9546))
- Serve CHAT Rooms (9x9 Tricky) on Mondays in place of Easy Light Up (7x7). A website that predates CHAT Rooms cannot draw it, so this release must follow the website release ([#9675](https://github.com/open-chat-labs/open-chat/pull/9675))
- Price a daily puzzle hint at 100 CHIT, with one hint level instead of three ([#9675](https://github.com/open-chat-labs/open-chat/pull/9675))
- Store with each hint the cells each of its conclusions is drawn on, so the LocalUserIndex can compare them with the hint's cells ([#9675](https://github.com/open-chat-labs/open-chat/pull/9675))
- Make every hint step in Light Up, Tents, Slant and Bridges list the cells it relies on, and outline what the step is about rather than the cell it decides ([#9675](https://github.com/open-chat-labs/open-chat/pull/9675))
- Generate CHAT Rooms candidates several times faster by holding each cell's shadow as a bit mask, so a 9x9 Tricky candidate stays far inside the 40B instruction limit ([#9716](https://github.com/open-chat-labs/open-chat/pull/9716))

### Fixed

- Point a Tents "line exact" hint at only the cells it fills, not the whole line, since the line includes cells ruled out by steps the player is never shown ([#9535](https://github.com/open-chat-labs/open-chat/pull/9535))
- Stop Tents line hints pointing at cells the player can't see ([#9615](https://github.com/open-chat-labs/open-chat/pull/9615))
- Retry a candidate generation that traps with a different seed. The trap rolled back its own failure count, so every retry used the seed that trapped, and a trap on the first candidate meant the day never shipped ([#9716](https://github.com/open-chat-labs/open-chat/pull/9716))
