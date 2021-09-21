use crate::model::events::GroupChatEventInternal;
use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::c2c_leave_group::{Response::*, *};
use ic_cdk_macros::update;
use types::ParticipantLeft;

// Called via the user's user canister
#[update]
fn c2c_leave_group(_args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| c2c_leave_group_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_leave_group_impl(runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    match runtime_state.data.participants.remove(user_id) {
        true => {
            let event = ParticipantLeft { user_id };
            runtime_state
                .data
                .events
                .push_event(GroupChatEventInternal::ParticipantLeft(Box::new(event)), now);

            handle_activity_notification(runtime_state);

            Success(SuccessResult {})
        }
        false => NotInGroup,
    }
}
