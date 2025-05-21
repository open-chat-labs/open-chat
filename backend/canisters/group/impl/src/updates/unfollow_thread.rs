use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::unfollow_thread::*;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn unfollow_thread(args: Args) -> Response {
    execute_update(|state| unfollow_thread_impl(args, state)).into()
}

fn unfollow_thread_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();
    state
        .data
        .chat
        .unfollow_thread(user_id, args.thread_root_message_index, now)?;

    state.data.mark_group_updated_in_user_canister(user_id);
    Ok(())
}
