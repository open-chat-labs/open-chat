use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::pin_message_v2::{Response::*, *};
use group_chat_core::PinUnpinMessageResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn pin_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| pin_message_impl(args, state))
}

fn pin_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.lookup_user_id(&caller) {
        let now = runtime_state.env.now();
        match runtime_state.data.chat.pin_message(user_id, args.message_index, now) {
            PinUnpinMessageResult::Success(r) => {
                handle_activity_notification(runtime_state);
                Success(r)
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
