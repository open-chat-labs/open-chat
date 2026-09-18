use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::OCResult;
use user_canister::unblock_user::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn unblock_user(args: Args) -> Response {
    mutate_state(|state| unblock_user_impl(args, state)).into()
}

fn unblock_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let (my_index, changed) = state.with_caller_user_mut(|index, user| -> OCResult<_> {
        user.verify_not_suspended()?;
        Ok((index, user.unblock_user(args.user_id, now)))
    })?;

    if changed {
        state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserUnblocked(args.user_id), now);
    }
    Ok(())
}
