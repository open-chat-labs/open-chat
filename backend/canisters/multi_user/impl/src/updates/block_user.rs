use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::block_user::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn block_user(args: Args) -> Response {
    mutate_state(|state| block_user_impl(args, state)).into()
}

fn block_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| {
        user.verify_not_suspended()?;
        user.block_user(args.user_id, now);
        Ok(())
    })
}
