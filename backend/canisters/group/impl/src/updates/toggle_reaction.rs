use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ToggleReactionResult;
use group_canister::toggle_reaction::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        mutate_state(|state| toggle_reaction_impl(args, state))
    } else {
        InvalidReaction
    }
}

fn toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();
        let user_id = participant.user_id;

        if !participant.role.can_react_to_messages(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        if !runtime_state.data.events.is_message_accessible_by_id(
            participant.min_visible_event_index(),
            args.thread_root_message_index,
            args.message_id,
        ) {
            return MessageNotFound;
        }

        if let Some(chat_events) = runtime_state.data.events.get_mut(args.thread_root_message_index) {
            let (event_index, added) = match chat_events.toggle_reaction(user_id, args.message_id, args.reaction, now) {
                ToggleReactionResult::Added(e) => (e, true),
                ToggleReactionResult::Removed(e) => (e, false),
                ToggleReactionResult::MessageNotFound => return MessageNotFound,
            };

            if let Some(thread_message_index) = args.thread_root_message_index {
                runtime_state
                    .data
                    .events
                    .main
                    .update_thread_summary(thread_message_index, user_id, false, event_index, now);
            }

            handle_activity_notification(runtime_state);

            if added {
                Added(event_index)
            } else {
                Removed(event_index)
            }
        } else {
            MessageNotFound
        }
    } else {
        CallerNotInGroup
    }
}
