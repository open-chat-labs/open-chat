use crate::model::events::GroupChatEventInternal;
use crate::model::participants::AddResult;
use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::c2c_join_group::{Response::*, *};
use ic_cdk_macros::update;
use types::{EventIndex, MessageIndex, ParticipantJoined};

// Called via the user's user canister
#[update]
fn c2c_join_group(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| c2c_join_group_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_join_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_public {
        let user_id = runtime_state.env.caller().into();
        let now = runtime_state.env.now();
        let min_visible_event_index;
        let min_visible_message_index;
        if runtime_state.data.history_visible_to_new_joiners {
            min_visible_event_index = EventIndex::default();
            min_visible_message_index = MessageIndex::default();
        } else {
            min_visible_event_index = runtime_state.data.events.last().index.incr();
            min_visible_message_index = runtime_state.data.events.next_message_index();
        };

        match runtime_state.data.participants.add(
            user_id,
            args.principal,
            now,
            min_visible_event_index,
            min_visible_message_index,
        ) {
            AddResult::Success => {
                let event = ParticipantJoined { user_id };
                runtime_state
                    .data
                    .events
                    .push_event(GroupChatEventInternal::ParticipantJoined(event), now);

                handle_activity_notification(runtime_state);

                Success(SuccessResult {})
            }
            AddResult::AlreadyInGroup => AlreadyInGroup,
            AddResult::Blocked => Blocked,
        }
    } else {
        GroupNotPublic
    }
}
