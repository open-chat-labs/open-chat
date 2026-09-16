use crate::env::ENV;
use crate::{TestEnv, client};
use std::ops::Deref;
use user_canister::c2c_game_chit::Args;

// `c2c_game_chit` is refused at ingress, so its idempotency and refusal paths are driven through
// the local user index's daily puzzle endpoints in `daily_puzzle_flow_tests`.
#[test]
fn game_chit_rejected_at_ingress() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let starting_balance = client::user::happy_path::initial_state(env, &user).chit_balance;

    let args = Args {
        user_id: user.user_id,
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
    assert_eq!(
        client::user::happy_path::initial_state(env, &user).chit_balance,
        starting_balance
    );
}
