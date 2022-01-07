use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::set_pinned_message::{Response::*, *};
use ic_cdk_macros::update;
use types::PinnedMessageUpdated;

#[update]
#[trace]
async fn set_pinned_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_pinned_message_impl(args, state))
}

fn set_pinned_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if !participant.role.can_set_pinned_message() {
            return NotAuthorized;
        }

        if args.message_index == runtime_state.data.pinned_message {
            return NoChange;
        }

        if let Some(message_index) = args.message_index {
            let is_valid_message_index = runtime_state
                .data
                .events
                .latest_message_index()
                .map_or(false, |i| i >= message_index);

            if !is_valid_message_index {
                return MessageIndexOutOfRange;
            }
        }

        let now = runtime_state.env.now();

        runtime_state.data.pinned_message = args.message_index;
        runtime_state.data.events.push_event(
            ChatEventInternal::PinnedMessageUpdated(Box::new(PinnedMessageUpdated {
                new_value: args.message_index,
                updated_by: participant.user_id,
            })),
            now,
        );

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
