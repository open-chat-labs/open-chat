use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use types::c2c_uninstall_bot::*;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_uninstall_bot(args: Args) -> Response {
    mutate_state(|state| c2c_uninstall_bot_impl(args, state)).into()
}

// The user uninstalling the bot is `args.caller`, who must be one of this canister's users. The
// OpenChat bot uninstalling on a user's behalf names no user, which a canister holding many can't
// act on; a bot removed everywhere reaches each user via the `BotRemoved` event instead.
fn c2c_uninstall_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let user_index = state
        .index_of_local_user(args.caller)
        .ok_or(OCErrorCode::InitiatorNotAuthorized)?;
    let my_user_id = state.user_id(user_index);
    let now = state.env.now();
    let prefixes = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            user_core::updates::c2c_uninstall_bot(user, &args, my_user_id, now)
        })
        .unwrap_or_else(|| Err(OCErrorCode::InitiatorNotAuthorized.into()))?;
    state.garbage_collect_stable_memory_keys(user_index, prefixes);
    Ok(())
}
