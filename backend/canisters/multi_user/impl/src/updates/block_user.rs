use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use multi_user_canister::block_user::*;
use types::OCResult;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn block_user(args: Args) -> Response {
    execute_update(|state| block_user_impl(args, state)).into()
}

fn block_user_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let my_index = state.caller_user_index_or_trap();
    let data = &mut state.data;
    let blocked = data
        .users
        .with_user_mut(my_index, |user| -> OCResult<_> {
            user.verify_not_suspended()?;
            Ok(user.block_user(args.user_id, &data.migrated_user_ids, now))
        })
        .expect("User not found")?;

    if let Some(user_id) = blocked {
        state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserBlocked(user_id), now);
    }
    Ok(())
}
