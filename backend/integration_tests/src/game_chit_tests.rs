use crate::env::ENV;
use crate::{TestEnv, User, client};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use types::ChitEventType;
use user_canister::c2c_game_chit::{Args, Response};

// `c2c_*` methods are refused at ingress by inspect_message, so these two tests cannot impersonate the
// local user index directly. Once the local user index exposes a game CHIT endpoint, route `call`
// through it (as `pay_for_premium_item_succeeds` does) and drop the ignores.
#[test]
#[ignore = "needs a local_user_index endpoint that forwards to c2c_game_chit"]
fn game_chit_credit_debit_and_idempotency() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let local_user_index = canister_ids.local_user_index(env, user.canister());
    let starting_balance = chit_balance(env, &user);

    // Credit
    let Response::Success(result) = call(env, local_user_index, &user, "light_up", "142:solve", 250) else {
        panic!("credit should succeed")
    };
    assert_eq!(result.chit_balance, starting_balance + 250);
    assert_eq!(result.total_chit_earned, starting_balance + 250);
    assert_eq!(chit_balance(env, &user), starting_balance + 250);

    // Same key again is rejected without changing the balance
    let Response::Error(error) = call(env, local_user_index, &user, "light_up", "142:solve", 250) else {
        panic!("duplicate key should be rejected")
    };
    assert!(error.matches_code(OCErrorCode::AlreadyAdded));
    assert_eq!(chit_balance(env, &user), starting_balance + 250);

    // Debit
    let Response::Success(result) = call(env, local_user_index, &user, "light_up", "142:hint:1", -100) else {
        panic!("debit should succeed")
    };
    assert_eq!(result.chit_balance, starting_balance + 150);
    assert_eq!(result.total_chit_earned, starting_balance + 250);
    assert_eq!(chit_balance(env, &user), starting_balance + 150);

    // Debit more than the balance
    let too_much = -(starting_balance + 150 + 1);
    let Response::Error(error) = call(env, local_user_index, &user, "light_up", "142:hint:2", too_much) else {
        panic!("unaffordable debit should be rejected")
    };
    assert!(error.matches_code(OCErrorCode::InsufficientFunds));
    assert_eq!(chit_balance(env, &user), starting_balance + 150);

    // Once affordable, the same debit key succeeds
    let Response::Success(_) = call(env, local_user_index, &user, "light_up", "143:solve", 250) else {
        panic!("credit should succeed")
    };
    let Response::Success(result) = call(env, local_user_index, &user, "light_up", "142:hint:2", too_much) else {
        panic!("retried debit should succeed once affordable")
    };
    assert_eq!(result.chit_balance, starting_balance + 400 + too_much);
    assert_eq!(chit_balance(env, &user), starting_balance + 400 + too_much);

    let events = client::user::happy_path::chit_events(env, &user, None, None, 10);
    assert!(events.events.iter().any(|e| matches!(
        &e.reason,
        ChitEventType::Game { game_id, key } if game_id == "light_up" && key == "142:solve"
    )));
}

#[test]
#[ignore = "needs a local_user_index endpoint that forwards to c2c_game_chit"]
fn game_chit_invalid_args_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let local_user_index = canister_ids.local_user_index(env, user.canister());
    let starting_balance = chit_balance(env, &user);

    for (game_id, key, amount) in [
        ("light_up", "1:solve", 0),
        ("light_up", "1:solve", 100_001),
        ("light_up", "1:solve", -100_001),
        // `abs()` wraps for this one value, so it used to pass both the limit and the balance
        // check and take the balance to roughly negative two billion
        ("light_up", "1:solve", i32::MIN),
        ("", "1:solve", 10),
        ("light_up", "", 10),
        (&"g".repeat(65), "1:solve", 10),
        ("light_up", &"k".repeat(65), 10),
    ] {
        let Response::Error(error) = call(env, local_user_index, &user, game_id, key, amount) else {
            panic!("expected InvalidRequest for {game_id:?} {key:?} {amount}")
        };
        assert!(error.matches_code(OCErrorCode::InvalidRequest));
    }
    assert_eq!(chit_balance(env, &user), starting_balance);
}

#[test]
fn game_chit_rejected_at_ingress() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let starting_balance = chit_balance(env, &user);

    let args = Args {
        game_id: "light_up".to_string(),
        key: "142:solve".to_string(),
        amount: 250,
    };
    let result = env.update_call(
        user.canister(),
        user.principal,
        "c2c_game_chit_msgpack",
        msgpack::serialize_then_unwrap(&args),
    );
    assert!(result.is_err(), "ingress call to a c2c method should be rejected");
    assert_eq!(chit_balance(env, &user), starting_balance);
}

fn call(
    env: &mut PocketIc,
    local_user_index: candid::Principal,
    user: &User,
    game_id: &str,
    key: &str,
    amount: i32,
) -> Response {
    client::user::c2c_game_chit(
        env,
        local_user_index,
        user.canister(),
        &Args {
            game_id: game_id.to_string(),
            key: key.to_string(),
            amount,
        },
    )
}

fn chit_balance(env: &PocketIc, user: &User) -> i32 {
    client::user::happy_path::initial_state(env, user).chit_balance
}
