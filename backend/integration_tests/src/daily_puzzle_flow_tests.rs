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
    CanisterId, ChitEventType, DAILY_PUZZLE_CHIT_GAME_ID, DailyPuzzleConfig, DailyPuzzleUserState, GameConfig,
    LIGHT_UP_GAME_ID, PublicDailyPuzzle, PuzzleNumber, UnitResult,
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

    // Launch: enable in the daily canister, push, then point the LUI at it
    let config = DailyPuzzleConfig::default();
    client::daily_puzzle::happy_path::set_enabled(env, user.principal, canister_ids.daily_puzzle, true);
    client::daily_puzzle::happy_path::push_now(env, user.principal, canister_ids.daily_puzzle);
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

    // First play is free, and the state says so: the fee the client sends is the one it was told
    assert_eq!(state.entry_fee, 0);
    let started = start(env, &user, local_user_index, game_id, number, state.entry_fee);
    let started_at = started.started_at;
    assert_eq!(started.state.started_at, Some(started_at));
    // Nothing left to pay once the record exists
    assert_eq!(started.state.entry_fee, 0);
    assert!(!started.state.has_solved_before);
    assert_eq!(chit_balance(env, &user), DAILY_CHIT);
    // Nothing was debited, so the response carries no balance
    assert_eq!(started.chit_balance, None);
    assert_eq!(started.total_chit_earned, None);

    // The step the engine will serve. It prefers the first step that puts a mark on the board over
    // the earliest outstanding one, because the cheap rules run to a standstill first and their
    // negatives-only conclusions cost a hint and teach nothing. Which generator today's schedule
    // serves decides whether that is trace[0] or not, so derive it rather than assuming.
    let expected_step = trace
        .iter()
        .find(|c| c.iter().any(|(_, value)| *value != 0))
        .unwrap_or(&trace[0]);

    // Level 1 hint: highlights the step, and carries neither the technique nor the conclusions,
    // which are what levels 2 and 3 are sold for. Every level costs, so this one is debited like
    // any other.
    let level_1_price = puzzle.hint_prices[0];
    assert!(level_1_price > 0, "no hint level is free");
    let first = hint(env, &user, local_user_index, game_id, number, 1, Vec::new(), level_1_price);
    assert!(!first.hint.mistake);
    assert_eq!(first.hint.level, 1);
    assert_eq!(first.hint.hint.technique, 0);
    assert!(first.hint.hint.target.is_empty());
    assert!(first.hint.hint.conclusions.is_empty());
    assert!(!first.hint.hint.focus.is_empty());
    assert_eq!(first.hints_used, 1);
    let balance_after_first = DAILY_CHIT - level_1_price as i32;
    assert_eq!(chit_balance(env, &user), balance_after_first);
    assert_eq!(first.chit_balance, Some(balance_after_first));

    // Upgrading the same step to level 3: the only tier that hands over the conclusions, and the
    // step is still the one step used. The upgrade is priced at the difference, so climbing costs
    // the same as jumping straight here. Hint keys are not grid indices in every game (bridges
    // keys edges), so compare against the solver's trace rather than the solution bytes. Level 2's
    // payload is covered by the engine's own tests.
    let upgrade_price = puzzle.hint_prices[2] - level_1_price;
    let upgraded = hint(env, &user, local_user_index, game_id, number, 3, Vec::new(), upgrade_price);
    assert!(!upgraded.hint.mistake);
    assert_eq!(upgraded.hint.level, 3);
    assert_ne!(upgraded.hint.hint.technique, 0);
    // Level 3 carries the generator's focus in deduction order; the lower levels sort it, so the
    // position of the concluded key does not name it below the level that sells it
    let mut focus_at_3 = upgraded.hint.hint.focus.clone();
    focus_at_3.sort_unstable();
    assert_eq!(focus_at_3, first.hint.hint.focus);
    assert_eq!(upgraded.hint.hint.conclusions, *expected_step);
    assert_eq!(upgraded.hints_used, 1);
    assert_eq!(upgraded.state.hints.len(), 1);
    let balance_after_hint = balance_after_first - upgrade_price as i32;
    assert_eq!(balance_after_hint, DAILY_CHIT - puzzle.hint_prices[2] as i32);
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
    let solve_key = format!("{number}:solve");
    assert!(
        events.iter().any(|e| matches!(
            &e.reason,
            ChitEventType::Game { game_id: g, key }
                if g == game_id && key.starts_with(&hint_prefix) && key.ends_with(":3")
        ) && e.amount == -(upgrade_price as i32)),
        "no hint debit event: {events:?}"
    );
    assert!(
        events.iter().any(|e| matches!(
            &e.reason,
            ChitEventType::Game { game_id: g, key } if g == DAILY_PUZZLE_CHIT_GAME_ID && key == &solve_key
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

    // Kill switch. No `push_now` here: the flip has to reach the LUI on `set_enabled`'s own push,
    // which is all the admin tab calls. An LUI holding a puzzle never pulls, so a flip that did
    // not push would leave the game running until midnight (#9357 invariant 3).
    client::daily_puzzle::happy_path::set_enabled(env, user.principal, canister_ids.daily_puzzle, false);
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

    // Re-enable, again on `set_enabled`'s own push: the solved record survives
    client::daily_puzzle::happy_path::set_enabled(env, user.principal, canister_ids.daily_puzzle, true);
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

    // The flag was flipped and the clock moved
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

// The CHIT paths the happy flow never takes: a debit the user canister refuses, and a day paid
// once already. Both run through the user canister's idempotency keys, which `game_chit_tests`
// cannot reach directly because `c2c_game_chit` is refused at ingress. The numbers are this
// build's constants (#9357), so the refusals come from a user who holds no CHIT: the first play
// is free but a hint is not, and the second day's entry is not either.
#[test]
fn daily_puzzle_refused_debits_and_replayed_keys() {
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

    let config = DailyPuzzleConfig::default();
    let hint_prices = GameConfig::default().hint_prices;
    client::daily_puzzle::happy_path::set_enabled(env, user.principal, canister_ids.daily_puzzle, true);
    client::daily_puzzle::happy_path::push_now(env, user.principal, canister_ids.daily_puzzle);
    set_canister_id(env, &user, local_user_index, canister_ids.daily_puzzle);

    // Day one: the free first play, with no CHIT to buy a hint
    let (puzzle, state) = wait_for_puzzle(env, &user, local_user_index);
    let number = puzzle.number;
    let game_id = puzzle.game_id.as_str();
    assert!(puzzle.first_play_free);
    assert_eq!(puzzle.entry_fee, config.entry_fee);
    assert_eq!(state.entry_fee, 0);
    assert_eq!(chit_balance(env, &user), 0);
    let started = start(env, &user, local_user_index, game_id, number, 0);
    assert_eq!(started.chit_balance, None);
    assert_eq!(chit_balance(env, &user), 0);

    let (_, solution) = solve(game_id, &puzzle.description, puzzle.tier);
    let (wrong_key, wrong_value) = wrong_pair(game_id, &puzzle.description, &solution);
    let right_pair = (wrong_key, solution_value(game_id, &puzzle.description, &solution, wrong_key));

    // A paid hint the user cannot afford is refused, and the free check its call spent stays
    // spent: a refusal that only happens when the named keys are right must cost the same as a
    // mistake, or it answers "is this key right?" for nothing
    let daily_puzzle_hint::Response::Error(error) = client::local_user_index::daily_puzzle_hint(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_hint::Args {
            game_id: game_id.to_string(),
            number,
            level: 1,
            filled: vec![right_pair],
            expected_price: hint_prices[0],
        },
    ) else {
        panic!("hint should be refused with no CHIT");
    };
    assert!(error.matches_code(OCErrorCode::InsufficientFunds), "{error:?}");
    let state = state_of(fetch(env, &user, local_user_index), game_id).unwrap();
    assert!(state.hints.is_empty());
    assert_eq!(state.free_checks, 1);
    assert_eq!(chit_balance(env, &user), 0);

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
    assert_eq!(mistake.state.free_checks, 2);

    // Day two: the free play is spent, so the entry costs, and there is still no CHIT
    env.advance_time(Duration::from_millis(DAY_IN_MS));
    let (puzzle, state) = wait_for_puzzle(env, &user, local_user_index);
    let number = puzzle.number;
    let game_id = puzzle.game_id.as_str();
    let entry_fee = config.entry_fee;
    assert_eq!(state.entry_fee, entry_fee);
    assert_eq!(state.started_at, None);

    // No CHIT: the start is refused and leaves no record behind, so the day is not locked
    let daily_puzzle_start::Response::Error(error) = client::local_user_index::daily_puzzle_start(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_start::Args {
            game_id: game_id.to_string(),
            number,
            expected_entry_fee: entry_fee,
        },
    ) else {
        panic!("start should be refused with no CHIT");
    };
    assert!(error.matches_code(OCErrorCode::InsufficientFunds), "{error:?}");
    let state = state_of(fetch(env, &user, local_user_index), game_id).unwrap();
    assert_eq!(state.started_at, None);
    assert_eq!(state.entry_fee, entry_fee);

    // Funded, the same start goes through and is debited
    client::user::happy_path::claim_daily_chit(env, &user, None);
    let started = start(env, &user, local_user_index, game_id, number, entry_fee);
    let after_entry = DAILY_CHIT - entry_fee as i32;
    assert_eq!(chit_balance(env, &user), after_entry);
    assert_eq!(started.chit_balance, Some(after_entry));

    // Solve, and the reward lands. Day one was never solved, so this is a streak-zero reward
    let (_, solution) = solve(game_id, &puzzle.description, puzzle.tier);
    env.advance_time(Duration::from_secs(30));
    let daily_puzzle_submit::Response::Success(solved) =
        submit(env, &user, local_user_index, game_id, number, solution.clone())
    else {
        panic!("correct grid should solve");
    };
    let reward = config.reward_by_streak[0];
    assert_eq!(solved.reward, reward);
    tick_many(env, 3);
    let after_solve = after_entry + reward as i32;
    assert_eq!(chit_balance(env, &user), after_solve);

    // The operator replaces today's puzzle. The record goes with it, and the replacement is a
    // free restart that pays nothing a second time: the entry and solve keys name the day, not
    // the puzzle, so the user canister answers `AlreadyAdded` to both replays (#9357 invariant 4,
    // #9332 invariant 3).
    client::daily_puzzle::happy_path::regenerate_today(env, user.principal, canister_ids.daily_puzzle, None);
    let replacement = wait_for_replacement(env, &user, local_user_index, &puzzle.description);
    assert_eq!(replacement.number, number);
    let state = state_of(fetch(env, &user, local_user_index), replacement.game_id.as_str()).unwrap();
    assert_eq!(
        state.started_at, None,
        "the record should go with the puzzle it was made against"
    );
    assert!(state.solved.is_none());
    assert!(state.has_solved_before);
    assert_eq!(state.entry_fee, entry_fee);

    let game_id = replacement.game_id.as_str();
    let restarted = start(env, &user, local_user_index, game_id, number, entry_fee);
    assert_eq!(
        chit_balance(env, &user),
        after_solve,
        "the entry fee must not be charged twice"
    );
    assert_eq!(restarted.chit_balance, None);

    let (_, solution) = solve(game_id, &replacement.description, replacement.tier);
    env.advance_time(Duration::from_secs(30));
    let daily_puzzle_submit::Response::Success(solved) = submit(env, &user, local_user_index, game_id, number, solution) else {
        panic!("correct grid should solve");
    };
    assert_eq!(solved.reward, 0, "a day already paid must not pay again");
    assert_eq!(solved.chit_balance, None);
    assert_eq!(solved.streak, 1);
    tick_many(env, 3);
    assert_eq!(chit_balance(env, &user), after_solve);
    let state = state_of(fetch(env, &user, local_user_index), game_id).unwrap();
    assert_eq!(state.solved.as_ref().unwrap().reward, 0);

    let events = client::user::happy_path::chit_events(env, &user, None, None, 50).events;
    let game_events: Vec<_> = events
        .iter()
        .filter(|e| matches!(&e.reason, ChitEventType::Game { .. }))
        .collect();
    assert_eq!(game_events.len(), 2, "one entry and one solve: {game_events:?}");

    // The flag was flipped and the clock moved
    wrapper.discard();
}

// #9332 invariant 30. Every canister deploys alone in any order, so the local user index has to
// run with no daily canister, with the wrong one, and with the real one stopped mid-day. Nothing
// traps, every game call answers not-available until there is a puzzle, and a solve made while
// the daily canister is down still reaches the results index once it is back.
#[test]
fn daily_puzzle_survives_a_missing_wrong_or_stopped_daily_canister() {
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
    let number = day_number(env);

    let not_available = |env: &mut PocketIc| {
        let fetched = fetch(env, &user, local_user_index);
        assert!(fetched.puzzles.is_empty(), "{fetched:?}");
        let started = client::local_user_index::daily_puzzle_start(
            env,
            user.principal,
            local_user_index,
            &daily_puzzle_start::Args {
                game_id: LIGHT_UP_GAME_ID.to_string(),
                number,
                expected_entry_fee: 0,
            },
        );
        assert!(
            matches!(&started, daily_puzzle_start::Response::Error(e) if e.matches_code(OCErrorCode::NotInitialized)),
            "{started:?}"
        );
        let hinted = client::local_user_index::daily_puzzle_hint(
            env,
            user.principal,
            local_user_index,
            &daily_puzzle_hint::Args {
                game_id: LIGHT_UP_GAME_ID.to_string(),
                number,
                level: 1,
                filled: Vec::new(),
                expected_price: 0,
            },
        );
        assert!(
            matches!(&hinted, daily_puzzle_hint::Response::Error(e) if e.matches_code(OCErrorCode::NotInitialized)),
            "{hinted:?}"
        );
        let submitted = submit(env, &user, local_user_index, LIGHT_UP_GAME_ID, number, Vec::new());
        assert!(
            matches!(&submitted, daily_puzzle_submit::Response::Error(e) if e.matches_code(OCErrorCode::NotInitialized)),
            "{submitted:?}"
        );
    };

    // No daily canister id at all: an index deployed before the daily canister exists
    not_available(env);

    // The wrong canister: the pull fails, and the index keeps answering the same
    set_canister_id(env, &user, local_user_index, canister_ids.group_index);
    tick_many(env, 5);
    not_available(env);

    // The real one, and the game comes up
    client::daily_puzzle::happy_path::set_enabled(env, user.principal, canister_ids.daily_puzzle, true);
    client::daily_puzzle::happy_path::push_now(env, user.principal, canister_ids.daily_puzzle);
    set_canister_id(env, &user, local_user_index, canister_ids.daily_puzzle);
    let (puzzle, _) = wait_for_puzzle(env, &user, local_user_index);
    let game_id = puzzle.game_id.as_str();
    assert_eq!(puzzle.number, number);
    assert!(puzzle.first_play_free);

    // The daily canister goes down mid-day. The game runs off the index's own copy of the puzzle.
    client::stop_canister(env, *controller, canister_ids.daily_puzzle);
    client::user::happy_path::claim_daily_chit(env, &user, None);
    start(env, &user, local_user_index, game_id, number, 0);
    let served = hint(
        env,
        &user,
        local_user_index,
        game_id,
        number,
        1,
        Vec::new(),
        puzzle.hint_prices[0],
    );
    assert!(!served.hint.mistake);
    let (_, solution) = solve(game_id, &puzzle.description, puzzle.tier);
    env.advance_time(Duration::from_secs(30));
    let daily_puzzle_submit::Response::Success(solved) = submit(env, &user, local_user_index, game_id, number, solution) else {
        panic!("a correct grid should solve with the daily canister stopped");
    };
    assert!(solved.reward > 0);
    tick_many(env, 5);
    assert_eq!(
        chit_balance(env, &user),
        DAILY_CHIT - puzzle.hint_prices[0] as i32 + solved.reward as i32
    );

    // Back up, the solve made while it was down reaches the results index
    client::start_canister(env, *controller, canister_ids.daily_puzzle);
    let mut results = Vec::new();
    for _ in 0..MAX_WAIT_TICKS {
        results = client::daily_puzzle::happy_path::results(
            env,
            user.principal,
            canister_ids.daily_puzzle,
            game_id.to_string(),
            number,
            vec![user.user_id],
        );
        if !results.is_empty() {
            break;
        }
        env.advance_time(Duration::from_secs(5));
        env.tick();
    }
    assert_eq!(results.len(), 1, "{results:?}");
    assert_eq!(results[0].user_id, user.user_id);
    assert_eq!(results[0].hints_used, 1);

    // The flag was flipped, the clock moved, and a canister was stopped and started
    wrapper.discard();
}

// Ticks until the LUI serves an enabled puzzle for today other than the one it held
fn wait_for_replacement(env: &mut PocketIc, user: &User, local_user_index: CanisterId, previous: &[u8]) -> PublicDailyPuzzle {
    for _ in 0..MAX_WAIT_TICKS {
        let fetched = fetch(env, user, local_user_index);
        if let Some(puzzle) = fetched
            .puzzles
            .iter()
            .find(|p| p.enabled && p.number == day_number(env) && p.description != previous)
        {
            return puzzle.clone();
        }
        env.advance_time(Duration::from_secs(1));
        env.tick();
    }
    panic!("the LUI never served a replacement puzzle after {MAX_WAIT_TICKS} ticks");
}

// The solution's value for `key`, from the generating crate's pairs
fn solution_value(game_id: &str, description: &[u8], solution: &[u8], key: u16) -> u8 {
    let pairs = match game_id {
        light_up::GAME_ID => light_up::solution_pairs(description, solution),
        tents::GAME_ID => tents::solution_pairs(description, solution),
        loopy::GAME_ID => loopy::solution_pairs(description, solution),
        unruly::GAME_ID => unruly::solution_pairs(description, solution),
        slant::GAME_ID => slant::solution_pairs(description, solution),
        bridges::GAME_ID => bridges::solution_pairs(description, solution),
        other => panic!("no solution pairs for game {other}"),
    }
    .expect("valid description");
    pairs
        .iter()
        .find(|(k, _)| *k == key)
        .map(|(_, v)| *v)
        .expect("key from the pairs")
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
            assert!(
                $game::check_rules(description, &solution)
                    .expect("valid grid")
                    .is_empty()
            );
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
        light_up::GAME_ID => (
            light_up::solution_pairs(description, solution).expect("valid description"),
            |v| v ^ 1,
        ),
        tents::GAME_ID => (
            tents::solution_pairs(description, solution).expect("valid description"),
            |v| v ^ 1,
        ),
        loopy::GAME_ID => (
            loopy::solution_pairs(description, solution).expect("valid description"),
            |v| v ^ 1,
        ),
        unruly::GAME_ID => (
            unruly::solution_pairs(description, solution).expect("valid description"),
            |v| if v == 1 { 2 } else { 1 },
        ),
        slant::GAME_ID => (
            slant::solution_pairs(description, solution).expect("valid description"),
            |v| if v == 1 { 2 } else { 1 },
        ),
        bridges::GAME_ID => (
            bridges::solution_pairs(description, solution).expect("valid description"),
            |v| (v + 1) % 3,
        ),
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
