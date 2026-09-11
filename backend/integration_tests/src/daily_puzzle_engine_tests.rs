use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, User, client};
use candid::Principal;
use constants::DAY_IN_MS;
use local_user_index_canister::{
    c2c_daily_puzzle_push, daily_puzzle_fetch, daily_puzzle_start, daily_puzzle_submit, set_daily_puzzle_canister_id,
};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::SystemTime;
use types::{
    CanisterId, ChitEventType, DailyPuzzle, DailyPuzzleConfig, DailyPuzzleUserState, GameConfig, PuzzleHint, PuzzleNumber,
    UnitResult,
};

const GAME: &str = "light_up";
const OTHER: &str = "other";
const ENTRY_FEE: u32 = 100;
const REWARD: u32 = 250;
const DAY_ZERO: u64 = 1704067200000; // Mon Jan 01 2024 00:00:00 GMT+0000

#[test]
fn daily_puzzle_start_submit_and_streak() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let local_user_index = canister_ids.local_user_index(env, user.canister());
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, user.user_id);
    ensure_time_at_least_day0(env);

    // A stand-in for the daily_puzzle canister: any principal the test can send as. The pull the
    // LUI fires at it fails harmlessly and the results relay retries against it.
    let daily_puzzle_canister_id = client::create_canister(env, *controller);
    set_canister_id(env, &user, local_user_index, daily_puzzle_canister_id);

    // Before any push there is nothing to play
    let fetched = fetch(env, &user, local_user_index);
    assert!(fetched.puzzles.is_empty());
    assert!(fetched.states.is_empty());

    // Two games on the same number
    let number = day_number(env);
    let puzzle = build_puzzle(GAME, number, true);
    let other = build_puzzle(OTHER, number, true);
    push(
        env,
        daily_puzzle_canister_id,
        local_user_index,
        vec![puzzle.clone(), other.clone()],
    );

    let fetched = fetch(env, &user, local_user_index);
    assert_eq!(fetched.puzzles.len(), 2);
    assert_eq!(fetched.states.len(), 2);
    for public in &fetched.puzzles {
        assert_eq!(public.number, number);
        assert_eq!(public.description, puzzle.description);
        assert!(public.enabled);
        assert_eq!(public.max_hints, 2);
    }
    assert!(fetched.puzzles.iter().any(|p| p.game_id == GAME));
    assert!(fetched.puzzles.iter().any(|p| p.game_id == OTHER));
    for state in &fetched.states {
        assert_eq!(state.started_at, None);
        assert_eq!(state.streak, 0);
        assert!(!state.has_solved_before);
    }

    // Fund the user with CHIT so the entry fee is affordable
    client::user::happy_path::claim_daily_chit(env, &user, None);
    let balance_before = chit_balance(env, &user);
    assert!(balance_before >= ENTRY_FEE as i32);

    // Wrong fee is refused before any debit
    let daily_puzzle_start::Response::Error(error) = client::local_user_index::daily_puzzle_start(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_start::Args {
            game_id: GAME.to_string(),
            number,
            expected_entry_fee: ENTRY_FEE + 1,
        },
    ) else {
        panic!("start with the wrong fee should fail");
    };
    assert!(error.matches_code(OCErrorCode::PriceMismatch));
    assert_eq!(chit_balance(env, &user), balance_before);

    // An unknown game for today is not available
    let daily_puzzle_start::Response::Error(error) = client::local_user_index::daily_puzzle_start(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_start::Args {
            game_id: "unknown".to_string(),
            number,
            expected_entry_fee: ENTRY_FEE,
        },
    ) else {
        panic!("start of an unknown game should fail");
    };
    assert!(error.matches_code(OCErrorCode::NotInitialized));

    let started = start(env, &user, local_user_index, GAME, number, ENTRY_FEE);
    let started_at = started.started_at;
    assert_eq!(started.state.game_id, GAME);
    assert_eq!(started.state.started_at, Some(started_at));
    assert_eq!(chit_balance(env, &user), balance_before - ENTRY_FEE as i32);
    // The entry debit landed in this call, so the response reports the new balance
    assert_eq!(started.chit_balance, Some(balance_before - ENTRY_FEE as i32));
    assert_eq!(started.total_chit_earned, Some(total_chit_earned(env, &user)));
    // Starting one game does not start the other
    assert_eq!(state_for(env, &user, local_user_index, OTHER).started_at, None);

    // Wrong grid
    let daily_puzzle_submit::Response::Error(error) = submit(env, &user, local_user_index, GAME, number, vec![0; 9]) else {
        panic!("wrong grid should fail");
    };
    assert!(error.matches_code(OCErrorCode::InvalidRequest));
    assert_eq!(error.message(), Some("wrong"));
    assert_eq!(state_for(env, &user, local_user_index, GAME).submits, 1);
    assert_eq!(state_for(env, &user, local_user_index, OTHER).submits, 0);

    // Right grid
    let daily_puzzle_submit::Response::Success(solved) =
        submit(env, &user, local_user_index, GAME, number, puzzle.solution.clone())
    else {
        panic!("correct grid should solve");
    };
    assert_eq!(solved.reward, REWARD);
    assert_eq!(solved.streak, 1);
    assert_eq!(solved.hints_used, 0);
    assert_eq!(solved.solve_time_ms, solved.solved_at - started_at);

    tick_many(env, 3);
    assert_eq!(chit_balance(env, &user), balance_before - ENTRY_FEE as i32 + REWARD as i32);
    assert_eq!(solved.chit_balance, Some(chit_balance(env, &user)));
    assert_eq!(solved.total_chit_earned, Some(total_chit_earned(env, &user)));

    let events = client::user::happy_path::chit_events(env, &user, None, None, 20).events;
    let solve_key = format!("{GAME}:{number}:solve");
    let entry_key = format!("{GAME}:{number}:entry");
    assert!(events.iter().any(|e| matches!(
        &e.reason,
        ChitEventType::Game { game_id, key } if game_id == GAME && key == &solve_key
    ) && e.amount == REWARD as i32));
    assert!(events.iter().any(|e| matches!(
        &e.reason,
        ChitEventType::Game { game_id, key } if game_id == GAME && key == &entry_key
    ) && e.amount == -(ENTRY_FEE as i32)));

    // The solve is series-level: both states show the streak and has_solved_before, only one is solved
    let fetched = fetch(env, &user, local_user_index);
    for state in &fetched.states {
        assert_eq!(state.streak, 1);
        assert!(state.has_solved_before);
    }
    let state = state_for(env, &user, local_user_index, GAME);
    assert_eq!(state.solved.as_ref().unwrap().reward, REWARD);
    assert_eq!(state.submits, 2);
    assert!(state_for(env, &user, local_user_index, OTHER).solved.is_none());

    // Second submit is refused
    let daily_puzzle_submit::Response::Error(error) =
        submit(env, &user, local_user_index, GAME, number, puzzle.solution.clone())
    else {
        panic!("second submit should fail");
    };
    assert!(error.matches_code(OCErrorCode::AlreadyAwarded));

    // Start again: idempotent, same clock, no second debit
    let balance = chit_balance(env, &user);
    let again = start(env, &user, local_user_index, GAME, number, 999);
    assert_eq!(again.started_at, started_at);
    assert_eq!(chit_balance(env, &user), balance);
    // No debit this time, so no balance in the response
    assert_eq!(again.chit_balance, None);

    // The other game has its own entry fee and reward; the day still counts once for the streak
    let other_started = start(env, &user, local_user_index, OTHER, number, ENTRY_FEE);
    assert_eq!(other_started.state.game_id, OTHER);
    assert_eq!(chit_balance(env, &user), balance - ENTRY_FEE as i32);
    assert_eq!(other_started.chit_balance, Some(balance - ENTRY_FEE as i32));
    let daily_puzzle_submit::Response::Success(other_solved) =
        submit(env, &user, local_user_index, OTHER, number, other.solution.clone())
    else {
        panic!("correct grid should solve the other game");
    };
    assert_eq!(other_solved.reward, REWARD);
    assert_eq!(other_solved.streak, 1);
    tick_many(env, 3);
    assert_eq!(chit_balance(env, &user), balance - ENTRY_FEE as i32 + REWARD as i32);
    let events = client::user::happy_path::chit_events(env, &user, None, None, 20).events;
    let other_solve_key = format!("{OTHER}:{number}:solve");
    assert!(events.iter().any(|e| matches!(
        &e.reason,
        ChitEventType::Game { game_id, key } if game_id == OTHER && key == &other_solve_key
    ) && e.amount == REWARD as i32));
    let fetched = fetch(env, &user, local_user_index);
    assert!(fetched.states.iter().all(|s| s.solved.is_some() && s.streak == 1));

    // Disabled: fetch hides the puzzles and start is refused
    push(
        env,
        daily_puzzle_canister_id,
        local_user_index,
        vec![with_enabled(&puzzle, false), with_enabled(&other, false)],
    );
    let fetched = fetch(env, &user, local_user_index);
    assert!(fetched.puzzles.is_empty());
    assert!(fetched.states.is_empty());
    let daily_puzzle_start::Response::Error(error) = client::local_user_index::daily_puzzle_start(
        env,
        user.principal,
        local_user_index,
        &daily_puzzle_start::Args {
            game_id: GAME.to_string(),
            number,
            expected_entry_fee: ENTRY_FEE,
        },
    ) else {
        panic!("start should fail while disabled");
    };
    assert!(error.matches_code(OCErrorCode::NotInitialized));

    // Re-enabled with the same number: the solved records survive. A push of only one game drops
    // the other from the set.
    push(env, daily_puzzle_canister_id, local_user_index, vec![puzzle.clone()]);
    let fetched = fetch(env, &user, local_user_index);
    assert_eq!(fetched.puzzles.len(), 1);
    assert_eq!(fetched.puzzles[0].game_id, GAME);
    let state = state_for(env, &user, local_user_index, GAME);
    assert!(state.solved.is_some());
    assert_eq!(state.started_at, Some(started_at));

    // A push from anyone but the daily canister is rejected by the guard
    let result = env.update_call(
        local_user_index,
        user.principal,
        "c2c_daily_puzzle_push_msgpack",
        msgpack::serialize_then_unwrap(&c2c_daily_puzzle_push::Args {
            puzzles: vec![with_enabled(&puzzle, false)],
        }),
    );
    assert!(result.is_err(), "push from a user should be rejected");
    assert_eq!(fetch(env, &user, local_user_index).puzzles.len(), 1);
}

fn ensure_time_at_least_day0(env: &mut PocketIc) {
    if now_millis(env) < DAY_ZERO {
        env.set_time(SystemTime::now().into());
    }
}

fn day_number(env: &PocketIc) -> PuzzleNumber {
    (now_millis(env) / DAY_IN_MS) as PuzzleNumber
}

// 3x3 with a black cell in the middle. Solution: bulbs at 0, 6 and 8.
fn build_puzzle(game_id: &str, number: PuzzleNumber, enabled: bool) -> DailyPuzzle {
    DailyPuzzle {
        game_id: game_id.to_string(),
        number,
        tier: 0,
        description: vec![1, 3, 3, 0, 0, 0, 0, 0x10, 0, 0, 0, 0],
        solution: vec![1, 0, 0, 0, 0, 0, 1, 0, 1],
        solution_pairs: vec![(0, 1), (1, 0), (2, 0), (3, 0), (5, 0), (6, 1), (7, 0), (8, 1)],
        hints: vec![PuzzleHint {
            technique: 1,
            focus: vec![4],
            target: Vec::new(),
            conclusions: vec![(0, 1), (2, 0)],
        }],
        starts_at: number as u64 * DAY_IN_MS,
        expires_at: (number as u64 + 1) * DAY_IN_MS,
        config: DailyPuzzleConfig {
            enabled,
            entry_fee: ENTRY_FEE,
            first_play_free: false,
            reward_by_streak: vec![REWARD, 300, 350],
            ..DailyPuzzleConfig::default()
        },
        game_config: GameConfig {
            max_hints: 2,
            ..GameConfig::default()
        },
    }
}

fn with_enabled(puzzle: &DailyPuzzle, enabled: bool) -> DailyPuzzle {
    let mut puzzle = puzzle.clone();
    puzzle.config.enabled = enabled;
    puzzle
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

fn push(env: &mut PocketIc, sender: Principal, local_user_index: CanisterId, puzzles: Vec<DailyPuzzle>) {
    let response = client::local_user_index::c2c_daily_puzzle_push(
        env,
        sender,
        local_user_index,
        &c2c_daily_puzzle_push::Args { puzzles },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}

fn fetch(env: &PocketIc, user: &User, local_user_index: CanisterId) -> daily_puzzle_fetch::FetchResult {
    let daily_puzzle_fetch::Response::Success(result) =
        client::local_user_index::daily_puzzle_fetch(env, user.principal, local_user_index, &daily_puzzle_fetch::Args {});
    result
}

fn state_for(env: &PocketIc, user: &User, local_user_index: CanisterId, game_id: &str) -> DailyPuzzleUserState {
    fetch(env, user, local_user_index)
        .states
        .into_iter()
        .find(|s| s.game_id == game_id)
        .unwrap_or_else(|| panic!("no state for {game_id}"))
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

fn chit_balance(env: &PocketIc, user: &User) -> i32 {
    client::user::happy_path::initial_state(env, user).chit_balance
}

fn total_chit_earned(env: &PocketIc, user: &User) -> i32 {
    client::user::happy_path::initial_state(env, user).total_chit_earned
}
