use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::unblock_user::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn unblock_user(args: Args) -> Response {
    execute_update(|state| unblock_user_impl(args, state)).into()
}

fn unblock_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    let now = state.env.now();
    state.unblock_user(args.user_id, now);
    Ok(())
}
