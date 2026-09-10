use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, client};
use candid::Principal;
use constants::DAY_IN_MS;
use daily_puzzle_canister::PuzzleParams;
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use std::time::Duration;
use types::{
    DailyPuzzleConfig, DailyPuzzleResult, Empty, GameConfig, HttpRequest, LIGHT_UP_GAME_ID, PuzzleNumber, UnitResult, UserId,
};

/// The canister's test-mode schedule, Mon..Sun: (game_id, grid size). Mirrors
/// `daily_puzzle_canister_impl::model::schedule::test_schedule`.
const TEST_SCHEDULE: [(&str, u8); 7] = [
    ("light_up", 7),
    ("tents", 8),
    ("slant", 6),
    ("bridges", 7),
    ("loopy", 6),
    ("slant", 6),
    ("bridges", 7),
];

/// What the test schedule serves for puzzle number `number`. Number 0 (1970-01-01) was a Thursday.
fn scheduled(number: PuzzleNumber) -> (&'static str, u8) {
    TEST_SCHEDULE[((number + 3) % 7) as usize]
}

#[test]
fn daily_puzzle_canister_serves_todays_puzzle_and_guards_governance_calls() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let now = now_millis(env);
    let today = (now / DAY_IN_MS) as u32;

    // Installed disabled, with the default config
    let config = client::daily_puzzle::happy_path::config(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert_eq!(config, DailyPuzzleConfig::default());
    assert!(!config.enabled);

    // Every generator gets a default game config
    let game_configs = client::daily_puzzle::happy_path::game_configs(env, Principal::anonymous(), canister_ids.daily_puzzle);
    let expected: Vec<_> = ["bridges", "light_up", "loopy", "slant", "tents"]
        .into_iter()
        .map(|g| (g.to_string(), GameConfig::default()))
        .collect();
    assert_eq!(game_configs, expected);

    // test_mode generates today's puzzle synchronously during init: one game per day
    let (todays_game, todays_size) = scheduled(today);
    let puzzles = client::daily_puzzle::happy_path::current_puzzles(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert_eq!(puzzles.len(), 1);
    let puzzle = &puzzles[0];
    assert_eq!(puzzle.number, today);
    assert_eq!(puzzle.game_id, todays_game);
    assert_eq!(puzzle.starts_at, today as u64 * DAY_IN_MS);
    assert_eq!(puzzle.expires_at, (today as u64 + 1) * DAY_IN_MS);
    assert!(!puzzle.enabled);
    assert_eq!(puzzle.description[0], 1);
    assert_eq!(puzzle.description[1], todays_size);
    assert_eq!(puzzle.description[2], todays_size);
    assert_eq!(puzzle.hint_prices, GameConfig::default().hint_prices);
    assert_eq!(puzzle.max_hints, GameConfig::default().max_hints);

    // Tomorrow's pool fills in via timers
    let (tomorrows_game, _) = scheduled(today + 1);
    tick_many(env, 5);
    let candidates = client::daily_puzzle::happy_path::candidates(env, *controller, canister_ids.daily_puzzle, today + 1);
    assert_eq!(candidates.len(), 3);
    assert!(
        candidates
            .iter()
            .all(|c| c.game_id == tomorrows_game && !c.vetoed && c.hint_count > 0)
    );

    // Veto is keyed by game; a wrong game id is not found
    let response = client::daily_puzzle::veto_candidate(
        env,
        *controller,
        canister_ids.daily_puzzle,
        &daily_puzzle_canister::veto_candidate::Args {
            number: today + 1,
            game_id: "sudoku".to_string(),
            index: 0,
        },
    );
    assert!(matches!(response, UnitResult::Error(e) if e.matches_code(OCErrorCode::ItemNotFound)));
    client::daily_puzzle::happy_path::veto_candidate(
        env,
        *controller,
        canister_ids.daily_puzzle,
        today + 1,
        tomorrows_game.to_string(),
        0,
    );
    let candidates = client::daily_puzzle::happy_path::candidates(env, *controller, canister_ids.daily_puzzle, today + 1);
    assert!(candidates[0].vetoed);
    assert!(candidates[1..].iter().all(|c| !c.vetoed));

    // Governance guard
    let enabled = DailyPuzzleConfig {
        enabled: true,
        ..Default::default()
    };
    let result = env.update_call(
        canister_ids.daily_puzzle,
        Principal::from_slice(&[9, 9, 9]),
        "set_config_msgpack",
        msgpack::serialize_then_unwrap(&daily_puzzle_canister::set_config::Args { config: enabled.clone() }),
    );
    assert!(
        result.is_err(),
        "set_config from a non-governance principal should be rejected"
    );
    let config = client::daily_puzzle::happy_path::config(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert!(!config.enabled);

    client::daily_puzzle::happy_path::set_config(env, *controller, canister_ids.daily_puzzle, enabled.clone());
    let config = client::daily_puzzle::happy_path::config(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert!(config.enabled);
    let puzzles = client::daily_puzzle::happy_path::current_puzzles(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert!(puzzles[0].enabled);

    // Per-game config travels with the puzzle
    let game_config = GameConfig {
        hint_prices: vec![0, 50, 150],
        max_hints: 5,
    };
    client::daily_puzzle::happy_path::set_game_config(
        env,
        *controller,
        canister_ids.daily_puzzle,
        todays_game.to_string(),
        game_config.clone(),
    );
    let puzzles = client::daily_puzzle::happy_path::current_puzzles(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert_eq!(puzzles[0].hint_prices, game_config.hint_prices);
    assert_eq!(puzzles[0].max_hints, game_config.max_hints);
    let game_configs = client::daily_puzzle::happy_path::game_configs(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert_eq!(game_configs.len(), 5);
    assert_eq!(
        game_configs.iter().find(|(g, _)| g == todays_game).map(|(_, c)| c),
        Some(&game_config)
    );

    // Unknown user has no results
    let results = client::daily_puzzle::happy_path::results(
        env,
        Principal::anonymous(),
        canister_ids.daily_puzzle,
        LIGHT_UP_GAME_ID.to_string(),
        today,
        vec![UserId::from(Principal::from_slice(&[1, 2, 3]))],
    );
    assert!(results.is_empty());

    // Only local user indexes may report results
    let response = client::daily_puzzle::c2c_report_results(
        env,
        Principal::from_slice(&[4, 5, 6]),
        canister_ids.daily_puzzle,
        &daily_puzzle_canister::c2c_report_results::Args {
            results: vec![DailyPuzzleResult {
                game_id: LIGHT_UP_GAME_ID.to_string(),
                number: today,
                user_id: UserId::from(Principal::from_slice(&[1, 2, 3])),
                solve_time_ms: 1000,
                hints_used: 0,
                streak: 1,
                solved_at: now,
            }],
        },
    );
    assert!(matches!(response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)));

    let response =
        client::daily_puzzle::c2c_pull_puzzles(env, Principal::from_slice(&[4, 5, 6]), canister_ids.daily_puzzle, &Empty {});
    assert!(matches!(
        response,
        daily_puzzle_canister::c2c_pull_puzzles::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)
    ));

    // This test flipped `enabled`, so don't hand the env back to the pool
    wrapper.discard();
}

#[test]
fn daily_puzzle_generation_instruction_counts() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let now = now_millis(env);
    let today = (now / DAY_IN_MS) as u32;
    tick_many(env, 5);

    // The default schedule's larger slots plus light_up's other sizes
    for (game_id, width, tier) in [
        (LIGHT_UP_GAME_ID, 7u8, 1u8),
        (LIGHT_UP_GAME_ID, 10, 0),
        (LIGHT_UP_GAME_ID, 10, 1),
        ("tents", 10, 1),
    ] {
        let schedule = vec![
            PuzzleParams {
                game_id: game_id.to_string(),
                width,
                height: width,
                tier,
                black_pct: 20,
            };
            7
        ];
        client::daily_puzzle::happy_path::set_schedule(env, *controller, canister_ids.daily_puzzle, schedule);
        env.advance_time(Duration::from_secs(1));
        tick_many(env, 10);
        let candidates = client::daily_puzzle::happy_path::candidates(env, *controller, canister_ids.daily_puzzle, today + 1);
        assert_eq!(candidates.len(), 3, "{game_id} {width}x{width} tier {tier}");
        assert!(
            candidates
                .iter()
                .all(|c| c.game_id == game_id && c.description[1] == width && c.tier == tier)
        );
    }

    let response = client::http_request(
        env,
        Principal::anonymous(),
        canister_ids.daily_puzzle,
        &HttpRequest {
            method: "GET".to_string(),
            url: "/logs".to_string(),
            headers: Vec::new(),
            body: Vec::new(),
        },
    );
    let logs = String::from_utf8(response.body.to_vec()).unwrap();
    for line in logs.lines().filter(|l| l.contains("Generated candidate")) {
        println!("{line}");
    }

    wrapper.discard();
}

/// Walks a week of rollovers so every generator runs inside the canister, which also proves each
/// fits the timer callback's instruction limit.
#[test]
fn daily_puzzle_rotates_through_the_week() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let today = (now_millis(env) / DAY_IN_MS) as u32;
    let puzzles = client::daily_puzzle::happy_path::current_puzzles(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert_eq!(puzzles.len(), 1);
    assert_eq!(puzzles[0].number, today);
    assert_eq!(puzzles[0].game_id, scheduled(today).0);

    let mut seen = Vec::new();
    for day in 1..=7u32 {
        let number = today + day;
        let (game_id, size) = scheduled(number);

        // The 12:00 rollover tops up the next pool; the 00:00 one ships from it. Each candidate is
        // its own timer callback, so give each boundary a few ticks.
        env.advance_time(Duration::from_millis(DAY_IN_MS / 2));
        tick_many(env, 5);
        let candidates = client::daily_puzzle::happy_path::candidates(env, *controller, canister_ids.daily_puzzle, number);
        assert!(!candidates.is_empty(), "day {day}: no candidates for {game_id}");
        assert!(
            candidates.iter().all(|c| c.game_id == game_id && c.hint_count > 0),
            "day {day}: {candidates:?}"
        );
        env.advance_time(Duration::from_millis(DAY_IN_MS / 2));
        let mut puzzles = Vec::new();
        for _ in 0..20 {
            env.tick();
            puzzles = client::daily_puzzle::happy_path::current_puzzles(env, Principal::anonymous(), canister_ids.daily_puzzle);
            if puzzles.iter().any(|p| p.number == number) {
                break;
            }
        }
        assert_eq!(puzzles.len(), 1, "day {day}: {puzzles:?}");
        let puzzle = &puzzles[0];
        assert_eq!(puzzle.number, number, "day {day}: no puzzle shipped for number {number}");
        assert_eq!(puzzle.game_id, game_id, "day {day}");
        assert_eq!(puzzle.description[0], 1);
        assert_eq!(puzzle.description[1], size, "day {day} {game_id}");
        assert_eq!(puzzle.description[2], size, "day {day} {game_id}");
        seen.push(game_id);
    }
    for game_id in ["light_up", "tents", "slant", "bridges", "loopy"] {
        assert!(seen.contains(&game_id), "{game_id} never shipped: {seen:?}");
    }

    let response = client::http_request(
        env,
        Principal::anonymous(),
        canister_ids.daily_puzzle,
        &HttpRequest {
            method: "GET".to_string(),
            url: "/logs".to_string(),
            headers: Vec::new(),
            body: Vec::new(),
        },
    );
    let logs = String::from_utf8(response.body.to_vec()).unwrap();
    for line in logs.lines().filter(|l| l.contains("Generated candidate")) {
        println!("{line}");
    }

    // Time moved a week; don't hand the env back to the pool
    wrapper.discard();
}
