use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::pin_message::{Response::*, *};
use types::{OCResult, PushEventResult};

#[update(msgpack = true)]
#[trace]
fn pin_message(args: Args) -> Response {
    match execute_update(|state| pin_message_impl(args, true, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[update(msgpack = true)]
#[trace]
fn unpin_message(args: Args) -> Response {
    match execute_update(|state| pin_message_impl(args, false, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn pin_message_impl(args: Args, pin: bool, state: &mut RuntimeState) -> OCResult<PushEventResult> {
    state.data.verify_not_frozen()?;

    let user_id = state.get_calling_member(true)?.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    let result = if pin {
        channel.chat.pin_message(user_id, args.message_index, now)?
    } else {
        channel.chat.unpin_message(user_id, args.message_index, now)?
    };

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(PushEventResult {
        index: result.index,
        timestamp: now,
        expires_at: result.expires_at,
    })
}
