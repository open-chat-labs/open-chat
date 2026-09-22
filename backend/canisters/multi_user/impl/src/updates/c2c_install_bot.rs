use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{OCResult, c2c_install_bot::*};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: Args) -> Response {
    mutate_state(|state| c2c_install_bot_impl(args, state)).into()
}

// The user installing the bot is `args.caller`, who must be one of this canister's users
fn c2c_install_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let user_index = state
        .index_of_local_user(args.caller)
        .ok_or(OCErrorCode::InitiatorNotAuthorized)?;
    let my_user_id = state.user_id(user_index);
    let now = state.env.now();
    let anonymized_id: u128 = state.env.rng().random();
    state
        .data
        .users
        .with_user_mut(user_index, |user| {
            user_core::updates::c2c_install_bot(user, args, my_user_id, anonymized_id, now)
        })
        .unwrap_or_else(|| Err(OCErrorCode::InitiatorNotAuthorized.into()))
}
