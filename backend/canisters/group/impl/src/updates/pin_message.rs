use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::pin_message_v2::{Response::*, *};
use types::{OCResult, PushEventResult};

#[update(msgpack = true)]
#[trace]
fn pin_message_v2(args: Args) -> Response {
    match execute_update(|state| pin_message_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn pin_message_impl(args: Args, state: &mut RuntimeState) -> OCResult<PushEventResult> {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();
    let result = state.data.chat.pin_message(user_id, args.message_index, now)?;

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(PushEventResult {
        index: result.index,
        timestamp: now,
        expires_at: result.expires_at,
    })
}
