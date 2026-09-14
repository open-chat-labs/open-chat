use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, client};
use candid::Principal;
use constants::DAY_IN_MS;
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use std::time::Duration;
use types::{
    DailyPuzzleConfig, DailyPuzzleResult, Empty, GameConfig, HttpRequest, LIGHT_UP_GAME_ID, PuzzleNumber, UnitResult, UserId,
};

/// The rota, Mon..Sun: (game_id, grid size). Mirrors `daily_puzzle_canister_impl::model::schedule`,
/// which is the one definition (#9357); test mode runs the same rota as production.
const SCHEDULE: [(&str, u8); 7] = [
    ("light_up", 7),
    ("tents", 8),
    ("slant", 6),
    ("bridges", 7),
    ("unruly", 8),
    ("tents", 10),
    ("light_up", 10),
];

/// What the rota serves for puzzle number `number`. Number 0 (1970-01-01) was a Thursday.
fn scheduled(number: PuzzleNumber) -> (&'static str, u8) {
    SCHEDULE[((number + 3) % 7) as usize]
}

#[test]
fn daily_puzzle_canister_serves_todays_puzzle_and_guards_operator_calls() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);

    let now = now_millis(env);
    let today = (now / DAY_IN_MS) as u32;

    // Installed disabled, serving the build's constants (#9357 invariant 1)
    let config = client::daily_puzzle::happy_path::config(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert_eq!(config, DailyPuzzleConfig::default());
    assert!(!config.enabled);

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
    let candidates =
        client::daily_puzzle::happy_path::candidates(env, operator.principal, canister_ids.daily_puzzle, today + 1);
    assert_eq!(candidates.len(), 3);
    assert!(
        candidates
            .iter()
            .all(|c| c.game_id == tomorrows_game && !c.vetoed && c.hint_count > 0)
    );

    // Veto is keyed by game; a wrong game id is not found
    let response = client::daily_puzzle::veto_candidate(
        env,
        operator.principal,
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
        operator.principal,
        canister_ids.daily_puzzle,
        today + 1,
        tomorrows_game.to_string(),
        0,
    );
    let candidates =
        client::daily_puzzle::happy_path::candidates(env, operator.principal, canister_ids.daily_puzzle, today + 1);
    assert!(candidates[0].vetoed);
    assert!(candidates[1..].iter().all(|c| !c.vetoed));

    // Platform operator guard
    let non_operator = client::register_user(env, canister_ids);
    let response = client::daily_puzzle::set_enabled(
        env,
        non_operator.principal,
        canister_ids.daily_puzzle,
        &daily_puzzle_canister::set_enabled::Args { enabled: true },
    );
    assert!(
        matches!(response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "set_enabled from a non-operator should be rejected"
    );
    let config = client::daily_puzzle::happy_path::config(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert!(!config.enabled);

    // The flag is the one thing the operator moves; every number stays the constant
    client::daily_puzzle::happy_path::set_enabled(env, operator.principal, canister_ids.daily_puzzle, true);
    let config = client::daily_puzzle::happy_path::config(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert_eq!(
        config,
        DailyPuzzleConfig {
            enabled: true,
            ..DailyPuzzleConfig::default()
        }
    );
    let puzzles = client::daily_puzzle::happy_path::current_puzzles(env, Principal::anonymous(), canister_ids.daily_puzzle);
    assert!(puzzles[0].enabled);
    assert_eq!(puzzles[0].entry_fee, config.entry_fee);
    assert_eq!(puzzles[0].hint_prices, GameConfig::default().hint_prices);

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

    // Only local user indexes may pull puzzles or report results, and both verify the caller with
    // an outbound registry call, so neither is reachable as ingress at all: `inspect_message`
    // refuses them before the guard runs. A genuine caller is a canister, which never goes through
    // the ingress filter.
    let stranger = Principal::from_slice(&[4, 5, 6]);
    let report_args = daily_puzzle_canister::c2c_report_results::Args {
        results: vec![DailyPuzzleResult {
            game_id: LIGHT_UP_GAME_ID.to_string(),
            number: today,
            user_id: UserId::from(Principal::from_slice(&[1, 2, 3])),
            solve_time_ms: 1000,
            hints_used: 0,
            streak: 1,
            solved_at: now,
        }],
    };
    let result = env.update_call(
        canister_ids.daily_puzzle,
        stranger,
        "c2c_report_results_msgpack",
        msgpack::serialize_then_unwrap(&report_args),
    );
    assert!(result.is_err(), "c2c_report_results should not be reachable as ingress");

    let result = env.update_call(
        canister_ids.daily_puzzle,
        stranger,
        "c2c_pull_puzzles_msgpack",
        msgpack::serialize_then_unwrap(&Empty {}),
    );
    assert!(result.is_err(), "c2c_pull_puzzles should not be reachable as ingress");

    // This test flipped `enabled`, so don't hand the env back to the pool
    wrapper.discard();
}

/// Walks a week of rollovers so every rota entry, the 10x10 tricky boards included, is generated
/// inside the canister, which proves each fits the timer callback's instruction limit. The
/// "Generated candidate" log lines carry the instruction counts.
#[test]
fn daily_puzzle_rotates_through_the_week() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);

    // Start at the top of a day. The loop below steps in 12-hour jumps and its two halves are the
    // 12:00 top-up and the 00:00 ship, which only holds from there. The pooled env's clock is
    // wherever earlier tests left it, and from the second half of a day the first jump crosses
    // midnight: `generation_needed` then answers for `current` rather than `next`, so
    // `ensure_puzzles` promotes the day 1 pool and removes it before the assertion reads it.
    let into_day = now_millis(env) % DAY_IN_MS;
    env.advance_time(Duration::from_millis(DAY_IN_MS - into_day + 60_000));

    let today = (now_millis(env) / DAY_IN_MS) as u32;
    let mut puzzles = Vec::new();
    for _ in 0..20 {
        env.tick();
        puzzles = client::daily_puzzle::happy_path::current_puzzles(env, Principal::anonymous(), canister_ids.daily_puzzle);
        if puzzles.iter().any(|p| p.number == today) {
            break;
        }
    }
    assert_eq!(puzzles.len(), 1, "{puzzles:?}");
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
        let candidates =
            client::daily_puzzle::happy_path::candidates(env, operator.principal, canister_ids.daily_puzzle, number);
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
    for game_id in ["light_up", "tents", "slant", "bridges", "unruly"] {
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
