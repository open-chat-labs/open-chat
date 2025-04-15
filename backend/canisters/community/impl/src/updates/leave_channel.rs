use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::leave_channel::*;
use types::OCResult;

#[update(candid = true, msgpack = true)]
#[trace]
fn leave_channel(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| leave_channel_impl(args, state)).into()
}

fn leave_channel_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    channel.chat.leave(user_id, now)?;
    state.data.remove_user_from_channel(user_id, args.channel_id, now);

    handle_activity_notification(state);
    Ok(())
}
