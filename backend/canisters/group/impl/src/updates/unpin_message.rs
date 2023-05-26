use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::unpin_message::{Response::*, *};
use group_chat_core::PinUnpinMessageResult;
use ic_cdk_macros::update;

#[update]
#[trace]
async fn unpin_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| unpin_message_impl(args, state))
}

fn unpin_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(user_id) = state.data.lookup_user_id(&caller) {
        let now = state.env.now();
        match state.data.chat.unpin_message(user_id, args.message_index, now) {
            PinUnpinMessageResult::Success(r) => {
                handle_activity_notification(state);
                SuccessV2(r)
            }
            PinUnpinMessageResult::NoChange => NoChange,
            PinUnpinMessageResult::NotAuthorized => NotAuthorized,
            PinUnpinMessageResult::MessageNotFound => MessageNotFound,
            PinUnpinMessageResult::UserSuspended => UserSuspended,
            PinUnpinMessageResult::UserNotInGroup => CallerNotInGroup,
        }
    } else {
        CallerNotInGroup
    }
}
