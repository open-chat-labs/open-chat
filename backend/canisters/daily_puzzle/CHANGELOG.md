# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [unreleased]

### Added

- Add the DailyPuzzle canister: generates the daily Light Up puzzle, holds a vetoable candidate pool, pushes puzzles to local user indexes and indexes solve results
- Key puzzles, candidates and results by game id, schedule a game per weekday, add per-game configs (`set_game_config`, `game_configs`) and serve today's set via `current_puzzles` / `c2c_pull_puzzles`
- Add `regenerate_today` so governance can replace today's puzzle, optionally forcing a game
