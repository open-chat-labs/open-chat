use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::block_user::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn block_user(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| block_user_impl(args, state)).into()
}

fn block_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    let now = state.env.now();
    state.block_user(args.user_id, now);
    Ok(())
}
