use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::unfollow_thread::*;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn unfollow_thread(args: Args) -> Response {
    execute_update(|state| unfollow_thread_impl(args, state)).into()
}

fn unfollow_thread_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let user_id = state.get_calling_member(None, false)?.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    channel
        .chat
        .unfollow_thread(user_id, args.thread_root_message_index, now, &state.data.migrated_user_ids)?;
    state.mark_activity_for_user(user_id);
    Ok(())
}
