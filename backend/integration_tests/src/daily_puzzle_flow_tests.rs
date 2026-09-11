//! End-to-end: daily_puzzle canister -> local user index -> user canister (CHIT) -> back to the
//! daily_puzzle canister (results). Real generator, real pushes and pulls, no stand-ins.

use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, User, client};
use constants::DAY_IN_MS;
use local_user_index_canister::{
    daily_puzzle_fetch, daily_puzzle_hint, daily_puzzle_start, daily_puzzle_submit, set_daily_puzzle_canister_id,
};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::{Duration, SystemTime};
use types::{
    CanisterId, ChitEventType, DailyPuzzleConfig, DailyPuzzleUserState, GameConfig, LIGHT_UP_GAME_ID, PublicDailyPuzzle,
    PuzzleNumber, UnitResult,
};

const DAY_ZERO: u64 = 1704067200000; // Mon Jan 01 2024 00:00:00 GMT+0000
const DAILY_CHIT: i32 = 200;
const MAX_WAIT_TICKS: usize = 300;

#[test]
fn daily_puzzle_end_to_end() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    ensure_time_at_least_day0(env);
    keep_clear_of_midnight(env);

    let user = client::register_user(env, canister_ids);
    let local_user_index = canister_ids.local_user_index(env, user.canister());
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, user.user_id);

    // Launch: enable in the daily canister (defaults otherwise), push, then point the LUI at it
    let config = DailyPuzzleConfig {
        enabled: true,
        ..DailyPuzzleConfig::default()
    };
    client::daily_puzzle::happy_path::set_config(env, *controller, canister_ids.daily_puzzle, config.clone());
    client::daily_puzzle::happy_path::push_now(env, *controller, canister_ids.daily_puzzle);
    set_canister_id(env, &user, local_user_index, canister_ids.daily_puzzle);

    let (puzzle, state) = wait_for_puzzle(env, &user, local_user_index);
    let number = puzzle.number;
    let game_id = puzzle.game_id.as_str();
    println!("today's puzzle: {game_id} #{number} tier {}", puzzle.tier);
    assert_eq!(number, day_number(env));
    assert_eq!(puzzle.starts_at, number as u64 * DAY_IN_MS);
    assert_eq!(puzzle.expires_at, (number as u64 + 1) * DAY_IN_MS);
    assert_eq!(puzzle.entry_fee, config.entry_fee);
    assert_eq!(puzzle.hint_prices, GameConfig::default().hint_prices);
    assert!(puzzle.first_play_free);
    assert_eq!(state.game_id, game_id);
    assert_eq!(state.started_at, None);
    assert_eq!(state.streak, 0);
    assert!(!state.has_solved_before);

    // Solve it offline with the generator's own solver
    let (trace, solution) = solve(game_id, &puzzle.description, puzzle.tier);
    assert!(!solution.is_empty());
    assert!(!trace.is_empty());

    client::user::happy_path::claim_daily_chit(env, &user, None);
    assert_eq!(chit_balance(env, &user), DAILY_CHIT);

    // First play is free
    let started = start(env, &user, local_user_index, game_id, number, 0);
    let started_at = started.started_at;
    assert_eq!(started.state.started_at, Some(started_at));
    assert!(!started.state.has_solved_before);
    assert_eq!(chit_balance(env, &user), DAILY_CHIT);
    // Nothing was debited, so the response carries no balance
    assert_eq!(started.chit_balance, None);
    assert_eq!(started.total_chit_earned, None);

    // Level 1 hint: free, and it highlights the first step of the solver's own trace. It carries
    // neither the technique nor the conclusions, which are what levels 2 and 3 are sold for.
    let first = hint(env, &user, local_user_index, game_id, number, 1, Vec::new(), 0);
    assert!(!first.hint.mistake);
    assert_eq!(first.hint.level, 1);
    assert_eq!(first.hint.hint.technique, 0);
    assert!(first.hint.hint.target.is_empty());
    assert!(first.hint.hint.conclusions.is_empty());
    assert!(!first.hint.hint.focus.is_empty());
    assert_eq!(first.hints_used, 1);
    assert_eq!(chit_balance(env, &user), DAILY_CHIT);
    assert_eq!(first.chit_balance, None);

    // Upgrading the same step to level 3: the only tier that hands over the conclusions, and the
    // step is still the one step used. Hint keys are not grid indices in every game (bridges keys
    // edges), so compare against the solver's trace rather than the solution bytes. Level 2's
    // payload is covered by the engine's own tests; the balance here only stretches to one
    // purchase, and level 3 is the tier that must not be reachable for free.
    let level_3_price = puzzle.hint_prices[2];
    let upgraded = hint(env, &user, local_user_index, game_id, number, 3, Vec::new(), level_3_price);
    assert!(!upgraded.hint.mistake);
    assert_eq!(upgraded.hint.level, 3);
    assert_ne!(upgraded.hint.hint.technique, 0);
    assert_eq!(upgraded.hint.hint.focus, first.hint.hint.focus);
    assert_eq!(upgraded.hint.hint.conclusions, trace[0]);
    assert_eq!(upgraded.hints_used, 1);
    assert_eq!(upgraded.state.hints.len(), 1);
    let balance_after_hint = DAILY_CHIT - level_3_price as i32;
    assert_eq!(chit_balance(env, &user), balance_after_hint);
    // The debit landed in this call, so the response reports the user canister's balances
    assert_eq!(upgraded.chit_balance, Some(balance_after_hint));
    assert_eq!(upgraded.total_chit_earned, Some(total_chit_earned(env, &user)));

    // A wrong entry: free mistake hint focused on that key, nothing counted. The key is a real
    // hint key for this game (an edge for bridges and loopy, a cell otherwise) with a value that
    // is valid for the game but not the solution's.
    let (wrong_key, wrong_value) = wrong_pair(game_id, &puzzle.description, &solution);
    let mistake = hint(
        env,
        &user,
        local_user_index,
        game_id,
        number,
        1,
        vec![(wrong_key, wrong_value)],
        0,
    );
    assert!(mistake.hint.mistake);
    assert!(mistake.hint.hint.focus.contains(&wrong_key), "{:?}", mistake.hint.hint.focus);
    assert!(mistake.hint.hint.conclusions.is_empty());
    assert_eq!(mistake.hints_used, 1);
    assert_eq!(mistake.state.hints.len(), 1);
    assert_eq!(chit_balance(env, &user), balance_after_hint);
    assert_eq!(mistake.chit_balance, None);

    // Past `min_carded_solve_ms`, so the solve is published to the results index
    env.advance_time(Duration::from_secs(30));

    // Wrong grid
    let mut wrong_grid = solution.clone();
    wrong_grid[0] = if solution[0] == 0 { 1 } else { 0 };
    let daily_puzzle_submit::Response::Error(error) = submit(env, &user, local_user_index, game_id, number, wrong_grid) else {
        panic!("wrong grid should fail");
    };
    assert!(error.matches_code(OCErrorCode::InvalidRequest), "{error:?}");
    assert_eq!(error.message(), Some("wrong"));
    assert_eq!(chit_balance(env, &user), balance_after_hint);

    // Right grid: base reward minus one paid hint step
    let expected_reward = config.reward_by_streak[0] - config.hint_penalty;
    let daily_puzzle_submit::Response::Success(solved) =
        submit(env, &user, local_user_index, game_id, number, solution.clone())
    else {
        panic!("correct grid should solve");
    };
    assert_eq!(solved.reward, expected_reward);
    assert_eq!(solved.streak, 1);
    assert_eq!(solved.hints_used, 1);
    assert!(solved.solve_time_ms > 0);
    assert_eq!(solved.solve_time_ms, solved.solved_at - started_at);

    tick_many(env, 3);
    let balance_after_solve = balance_after_hint + expected_reward as i32;
    assert_eq!(chit_balance(env, &user), balance_after_solve);
    assert_eq!(solved.chit_balance, Some(balance_after_solve));
    assert_eq!(solved.total_chit_earned, Some(total_chit_earned(env, &user)));

    let events = client::user::happy_path::chit_events(env, &user, None, None, 50).events;
    let hint_prefix = format!("{game_id}:{number}:hint:");
    let solve_key = format!("{game_id}:{number}:solve");
    assert!(
        events.iter().any(|e| matches!(
            &e.reason,
            ChitEventType::Game { game_id: g, key }
                if g == game_id && key.starts_with(&hint_prefix) && key.ends_with(":3")
        ) && e.amount == -(level_3_price as i32)),
        "no hint debit event: {events:?}"
    );
    assert!(
        events.iter().any(|e| matches!(
            &e.reason,
            ChitEventType::Game { game_id: g, key } if g == game_id && key == &solve_key
        ) && e.amount == expected_reward as i32),
        "no solve credit event: {events:?}"
    );
    assert!(
        !events
            .iter()
            .any(|e| matches!(&e.reason, ChitEventType::Game { key, .. } if key.ends_with(":entry"))),
        "first play should not have been charged: {events:?}"
    );

    let state = state_of(fetch(env, &user, local_user_index), game_id).unwrap();
    assert_eq!(state.streak, 1);
    assert!(state.has_solved_before);
    assert_eq!(state.solved.as_ref().unwrap().reward, expected_reward);
    assert_eq!(state.submits, 2);
    // The stored solve record never carries a balance; only the submit response does
    assert_eq!(state.solved.as_ref().unwrap().chit_balance, None);

    // The result reaches the daily canister
    tick_many(env, 10);
    let results = client::daily_puzzle::happy_path::results(
        env,
        user.principal,
        canister_ids.daily_puzzle,
        game_id.to_string(),
        number,
        vec![user.user_id],
    );
    assert_eq!(results.len(), 1, "{results:?}");
    let result = &results[0];
    assert_eq!(result.user_id, user.user_id);
    assert_eq!(result.number, number);
    assert_eq!(result.game_id, game_id);
    assert!(result.solve_time_ms > 0);
    assert_eq!(result.solve_time_ms, solved.solve_time_ms);
    assert_eq!(result.hints_used, 1);
    assert_eq!(result.streak, 1);
    assert_eq!(result.solved_at, solved.solved_at);

    // Start again: idempotent, same clock, no debit
    let again = start(env, &user, local_user_index, game_id, number, 0);
    assert_eq!(again.started_at, started_at);
    assert_eq!(chit_balance(env, &user), balance_after_solve);
    assert_eq!(again.chit_balance, None);

    // Second submit is refused
    let daily_puzzle_submit::Response::Error(error) = submit(env, &user, local_user_index, game_id, number, solution.clone())
    else {
        panic!("second submit should fail");
    };
    assert!(error.matches_code(OCErrorCode::AlreadyAwarded), "{error:?}");

    // Kill switch
    let disabled = DailyPuzzleConfig {
        enabled: false,
        ..config.clone()
    };
    client::daily_puzzle::happy_path::set_config(env, *controller, canister_ids.daily_puzzle, disabled);
    client::daily_puzzle::happy_path::push_now(env, *controller, canister_ids.daily_puzzle);
    tick_many(env, 5);
    let fetched = fetch(env, &user, local_user_index);
    assert!(fetched.puzzles.is_empty(), "{fetched:?}");
    assert!(fetched.states.is_empty());
    let daily_puzzle_start::Response::Error(error) = client::local_user_index::daily_puzzle_start(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_start::Args {
            game_id: game_id.to_string(),
            number,
            expected_entry_fee: 0,
        },
    ) else {
        panic!("start should fail while disabled");
    };
    assert!(error.matches_code(OCErrorCode::NotInitialized), "{error:?}");

    // Re-enable: the solved record survives
    client::daily_puzzle::happy_path::set_config(env, *controller, canister_ids.daily_puzzle, config);
    client::daily_puzzle::happy_path::push_now(env, *controller, canister_ids.daily_puzzle);
    tick_many(env, 5);
    let fetched = fetch(env, &user, local_user_index);
    assert!(
        puzzle_of(&fetched, game_id).is_some_and(|p| p.enabled && p.number == number),
        "{fetched:?}"
    );
    let state = state_of(fetched, game_id).unwrap();
    assert_eq!(state.started_at, Some(started_at));
    assert_eq!(state.solved.as_ref().unwrap().reward, expected_reward);
    assert_eq!(state.streak, 1);

    // Config was mutated and the clock moved
    wrapper.discard();
}

#[test]
fn daily_puzzle_dark_by_default() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    ensure_time_at_least_day0(env);

    let user = client::register_user(env, canister_ids);
    let local_user_index = canister_ids.local_user_index(env, user.canister());
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, user.user_id);

    // Wire the LUI up (this pulls) but never enable
    set_canister_id(env, &user, local_user_index, canister_ids.daily_puzzle);
    tick_many(env, 5);

    let config = client::daily_puzzle::happy_path::config(env, user.principal, canister_ids.daily_puzzle);
    assert!(!config.enabled);

    let fetched = fetch(env, &user, local_user_index);
    assert!(fetched.puzzles.is_empty(), "{fetched:?}");
    assert!(fetched.states.is_empty());

    let daily_puzzle_start::Response::Error(error) = client::local_user_index::daily_puzzle_start(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_start::Args {
            game_id: LIGHT_UP_GAME_ID.to_string(),
            number: day_number(env),
            expected_entry_fee: 0,
        },
    ) else {
        panic!("start should fail while disabled");
    };
    assert!(error.matches_code(OCErrorCode::NotInitialized), "{error:?}");

    // The LUI now holds a daily canister id
    wrapper.discard();
}

fn ensure_time_at_least_day0(env: &mut PocketIc) {
    if now_millis(env) < DAY_ZERO {
        env.set_time(SystemTime::now().into());
    }
}

// The test advances the clock by a few seconds; don't let that cross a day boundary
fn keep_clear_of_midnight(env: &mut PocketIc) {
    let remaining = DAY_IN_MS - now_millis(env) % DAY_IN_MS;
    if remaining < 10 * 60 * 1000 {
        env.advance_time(Duration::from_millis(remaining + 60 * 1000));
    }
}

fn day_number(env: &PocketIc) -> PuzzleNumber {
    (now_millis(env) / DAY_IN_MS) as PuzzleNumber
}

// Ticks (and nudges the clock so timers fire) until the LUI serves today's enabled puzzle,
// whichever game the weekday rotation picked
fn wait_for_puzzle(env: &mut PocketIc, user: &User, local_user_index: CanisterId) -> (PublicDailyPuzzle, DailyPuzzleUserState) {
    let mut last = None;
    for _ in 0..MAX_WAIT_TICKS {
        let fetched = fetch(env, user, local_user_index);
        if let Some(puzzle) = fetched
            .puzzles
            .iter()
            .find(|p| p.enabled && p.number == day_number(env))
            .cloned()
        {
            let state = state_of(fetched, &puzzle.game_id).expect("state should accompany the puzzle");
            return (puzzle, state);
        }
        last = fetched.puzzles.first().cloned();
        env.advance_time(Duration::from_secs(1));
        env.tick();
    }
    panic!(
        "the LUI never served today's enabled puzzle (day {}) after {MAX_WAIT_TICKS} ticks; last seen: {last:?}",
        day_number(env)
    );
}

fn set_canister_id(env: &mut PocketIc, operator: &User, local_user_index: CanisterId, canister_id: CanisterId) {
    let response = client::local_user_index::set_daily_puzzle_canister_id(
        env,
        operator.principal,
        local_user_index,
        &set_daily_puzzle_canister_id::Args { canister_id },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 3);
}

fn fetch(env: &PocketIc, user: &User, local_user_index: CanisterId) -> daily_puzzle_fetch::FetchResult {
    let daily_puzzle_fetch::Response::Success(result) =
        client::local_user_index::daily_puzzle_fetch(env, user.principal, local_user_index, &daily_puzzle_fetch::Args {});
    result
}

fn puzzle_of<'a>(fetched: &'a daily_puzzle_fetch::FetchResult, game_id: &str) -> Option<&'a PublicDailyPuzzle> {
    fetched.puzzles.iter().find(|p| p.game_id == game_id)
}

fn state_of(fetched: daily_puzzle_fetch::FetchResult, game_id: &str) -> Option<DailyPuzzleUserState> {
    fetched.states.into_iter().find(|s| s.game_id == game_id)
}

// Solves with the generating crate's own solver and checks the answer against its rules.
// Returns each trace step's conclusions and the solution.
fn solve(game_id: &str, description: &[u8], tier: u8) -> (Vec<Vec<(u16, u8)>>, Vec<u8>) {
    macro_rules! solve_with {
        ($game:ident) => {{
            let tier = match tier {
                0 => $game::Tier::Easy,
                1 => $game::Tier::Tricky,
                other => panic!("unknown tier {other}"),
            };
            let (trace, solution) = $game::solve_with_trace(description, tier).expect("valid description");
            let solution = solution.expect("the solver should solve the puzzle it generated");
            assert!($game::check_rules(description, &solution).expect("valid grid").is_empty());
            (trace.into_iter().map(|h| h.conclusions).collect(), solution)
        }};
    }
    match game_id {
        light_up::GAME_ID => solve_with!(light_up),
        tents::GAME_ID => solve_with!(tents),
        slant::GAME_ID => solve_with!(slant),
        bridges::GAME_ID => solve_with!(bridges),
        loopy::GAME_ID => solve_with!(loopy),
        unruly::GAME_ID => solve_with!(unruly),
        other => panic!("no solver for game {other}"),
    }
}

// The first (key, value) of the generating crate's solution pairs, with the value changed to
// another one valid for that game.
fn wrong_pair(game_id: &str, description: &[u8], solution: &[u8]) -> (u16, u8) {
    #[expect(clippy::type_complexity)]
    let (pairs, flip): (Vec<(u16, u8)>, fn(u8) -> u8) = match game_id {
        light_up::GAME_ID => (light_up::solution_pairs(description, solution).expect("valid description"), |v| v ^ 1),
        tents::GAME_ID => (tents::solution_pairs(description, solution).expect("valid description"), |v| v ^ 1),
        loopy::GAME_ID => (loopy::solution_pairs(description, solution).expect("valid description"), |v| v ^ 1),
        unruly::GAME_ID => (unruly::solution_pairs(description, solution).expect("valid description"), |v| if v == 1 { 2 } else { 1 }),
        slant::GAME_ID => (slant::solution_pairs(description, solution).expect("valid description"), |v| if v == 1 { 2 } else { 1 }),
        bridges::GAME_ID => (bridges::solution_pairs(description, solution).expect("valid description"), |v| (v + 1) % 3),
        other => panic!("no solution pairs for game {other}"),
    };
    let (key, value) = *pairs.first().expect("the generator should emit solution pairs");
    (key, flip(value))
}

fn start(
    env: &mut PocketIc,
    user: &User,
    local_user_index: CanisterId,
    game_id: &str,
    number: PuzzleNumber,
    expected_entry_fee: u32,
) -> daily_puzzle_start::StartResult {
    match client::local_user_index::daily_puzzle_start(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_start::Args {
            game_id: game_id.to_string(),
            number,
            expected_entry_fee,
        },
    ) {
        daily_puzzle_start::Response::Success(result) => result,
        response => panic!("'daily_puzzle_start' error: {response:?}"),
    }
}

fn submit(
    env: &mut PocketIc,
    user: &User,
    local_user_index: CanisterId,
    game_id: &str,
    number: PuzzleNumber,
    grid: Vec<u8>,
) -> daily_puzzle_submit::Response {
    client::local_user_index::daily_puzzle_submit(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_submit::Args {
            game_id: game_id.to_string(),
            number,
            grid,
        },
    )
}

#[expect(clippy::too_many_arguments)]
fn hint(
    env: &mut PocketIc,
    user: &User,
    local_user_index: CanisterId,
    game_id: &str,
    number: PuzzleNumber,
    level: u8,
    filled: Vec<(u16, u8)>,
    expected_price: u32,
) -> daily_puzzle_hint::HintResult {
    match client::local_user_index::daily_puzzle_hint(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_hint::Args {
            game_id: game_id.to_string(),
            number,
            level,
            filled,
            expected_price,
        },
    ) {
        daily_puzzle_hint::Response::Success(result) => result,
        response => panic!("'daily_puzzle_hint' error: {response:?}"),
    }
}

fn chit_balance(env: &PocketIc, user: &User) -> i32 {
    client::user::happy_path::initial_state(env, user).chit_balance
}

fn total_chit_earned(env: &PocketIc, user: &User) -> i32 {
    client::user::happy_path::initial_state(env, user).total_chit_earned
}
