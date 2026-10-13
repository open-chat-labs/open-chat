use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use multi_user_canister::unblock_user::*;
use types::OCResult;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn unblock_user(args: Args) -> Response {
    execute_update(|state| unblock_user_impl(args, state)).into()
}

fn unblock_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    // The block is held under the user's latest id (see `block_user`)
    let user_id = state.data.migrated_user_ids.latest(args.user_id);
    let (my_index, changed) = state.with_caller_user_mut(|index, user| -> OCResult<_> {
        user.verify_not_suspended()?;
        Ok((index, user.unblock_user(user_id, now)))
    })?;

    if changed {
        state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserUnblocked(user_id), now);
    }
    Ok(())
}
