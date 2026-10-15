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
    let my_index = state.caller_user_index_or_trap();
    let data = &mut state.data;
    let unblocked = data
        .users
        .with_user_mut(my_index, |user| -> OCResult<_> {
            user.verify_not_suspended()?;
            Ok(user.unblock_user(args.user_id, now))
        })
        .expect("User not found")?;

    if unblocked {
        state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserUnblocked(args.user_id), now);
    }
    Ok(())
}
