use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::pin_message::{Response::*, *};
use ic_cdk_macros::update;
use types::MessagePinned;

#[update]
#[trace]
fn pin_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| pin_message_impl(args, state))
}

fn pin_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if !participant.role.can_pin_messages(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        if let Err(index) = runtime_state.data.pinned_messages.binary_search(&args.message_index) {
            let is_valid_message_index = runtime_state
                .data
                .events
                .latest_message_index()
                .map_or(false, |i| i >= args.message_index);

            if !is_valid_message_index {
                return MessageIndexOutOfRange;
            }

            let now = runtime_state.env.now();

            runtime_state.data.pinned_messages.insert(index, args.message_index);

            let event_index = runtime_state.data.events.push_event(
                ChatEventInternal::MessagePinned(Box::new(MessagePinned {
                    message_index: args.message_index,
                    pinned_by: participant.user_id,
                })),
                now,
            );

            handle_activity_notification(runtime_state);

            Success(event_index)
        } else {
            NoChange
        }
    } else {
        CallerNotInGroup
    }
}
