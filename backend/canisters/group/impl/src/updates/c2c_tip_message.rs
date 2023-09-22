use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_tip_message::{Response::*, *};
use group_chat_core::TipMessageResult;

#[update_msgpack]
#[trace]
fn c2c_tip_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_tip_message_impl(args, state))
}

fn c2c_tip_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return GroupFrozen;
    }

    let user_id = state.env.caller().into();
    let now = state.env.now();
    match state.data.chat.tip_message(
        user_id,
        args.message_sender,
        args.thread_root_message_index,
        args.message_id,
        args.transfer,
        now,
    ) {
        TipMessageResult::Success => {
            // TODO push notification
            handle_activity_notification(state);
            Success
        }
        TipMessageResult::MessageNotFound => MessageNotFound,
        TipMessageResult::CannotTipSelf => CannotTipSelf,
        TipMessageResult::MessageSenderMismatch => MessageSenderMismatch,
        TipMessageResult::UserNotInGroup => UserNotInGroup,
        TipMessageResult::NotAuthorized => NotAuthorized,
        TipMessageResult::UserSuspended => UserSuspended,
    }
}
