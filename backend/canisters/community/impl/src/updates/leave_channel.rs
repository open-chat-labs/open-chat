use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::leave_channel::*;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn leave_channel(args: Args) -> Response {
    execute_update(|state| leave_channel_impl(args, state)).into()
}

fn leave_channel_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    let result = channel.chat.leave(user_id, now)?;
    state.data.remove_user_from_channel(user_id, args.channel_id, now);

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
