use crate::model::events::GroupChatEventInternal;
use crate::model::participants::AddResult;
use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::join_group::{Response::*, *};
use ic_cdk_macros::update;
use types::{EventIndex, ParticipantJoined};

// Called via the user's user canister
#[update]
fn join_group(args: Args) -> Response {
    handle_activity_notification();

    RUNTIME_STATE.with(|state| join_group_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn join_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_public {
        let user_id = runtime_state.env.caller().into();
        let now = runtime_state.env.now();
        let latest_message_index = runtime_state.data.events.latest_message_index();
        let min_visible_event_index = if runtime_state.data.history_visible_to_new_joiners {
            EventIndex::default()
        } else {
            runtime_state.data.events.last().index
        };

        match runtime_state
            .data
            .participants
            .add(user_id, args.principal, now, latest_message_index, min_visible_event_index)
        {
            AddResult::Success => {
                let event = ParticipantJoined { user_id };
                runtime_state
                    .data
                    .events
                    .push_event(GroupChatEventInternal::ParticipantJoined(event), now);

                Success(SuccessResult {})
            }
            AddResult::AlreadyInGroup => AlreadyInGroup,
            AddResult::Blocked => Blocked,
        }
    } else {
        GroupNotPublic
    }
}
