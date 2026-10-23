use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{OCResult, UnitResult};
use user_index_canister::unlink_bridged_user::*;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
fn unlink_bridged_user(args: Args) -> Response {
    match mutate_state(|state| unlink_bridged_user_impl(args, state)) {
        Ok(()) => UnitResult::Success,
        Err(error) => UnitResult::Error(error),
    }
}

fn unlink_bridged_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();
    let Some(user) = state.data.users.get_by_principal(&caller) else {
        return Err(OCErrorCode::InitiatorNotFound.into());
    };

    // A bot can only unlink accounts on the platform it bridges, from whoever they're linked to.
    // A user can only unlink accounts from themself.
    let from = if user.user_type.is_bot() {
        state.check_caller_is_bridge_bot(args.user.platform())?;
        None
    } else {
        Some(user.user_id)
    };

    let now = state.env.now();
    if state.data.bridged_users.unlink(&args.user, from, now) {
        state.push_bridged_user_link(args.user, None);
    }
    Ok(())
}
