use crate::updates::handle_activity_notification;
use crate::updates::unblock_user::Response::*;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::ChatEventInternal;
use group_canister::unblock_user::*;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{EventIndex, MessageIndex, UsersUnblocked};

#[update]
#[instrument(level = "trace")]
fn unblock_user(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| unblock_user_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn unblock_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    if !runtime_state.data.is_public {
        GroupNotPublic
    } else if let Some(caller_participant) = runtime_state.data.participants.get_by_principal(caller) {
        let unblocked_by = caller_participant.user_id;
        if unblocked_by == args.user_id {
            CannotUnblockSelf
        } else if caller_participant.role.can_unblock_user() {
            let now = runtime_state.env.now();
            if let Some(principal) = runtime_state.data.participants.unblock(&args.user_id) {
                let min_visible_event_index;
                let min_visible_message_index;
                if runtime_state.data.history_visible_to_new_joiners {
                    min_visible_event_index = EventIndex::default();
                    min_visible_message_index = MessageIndex::default();
                } else {
                    min_visible_event_index = runtime_state.data.events.last().index.incr();
                    min_visible_message_index = runtime_state.data.events.next_message_index();
                };

                runtime_state.data.participants.add(
                    args.user_id,
                    principal,
                    now,
                    min_visible_event_index,
                    min_visible_message_index,
                );

                let event = UsersUnblocked {
                    user_ids: vec![args.user_id],
                    unblocked_by,
                };

                runtime_state
                    .data
                    .events
                    .push_event(ChatEventInternal::UsersUnblocked(Box::new(event)), now);

                handle_activity_notification(runtime_state);
            }
            Success
        } else {
            NotAuthorized
        }
    } else {
        CallerNotInGroup
    }
}
