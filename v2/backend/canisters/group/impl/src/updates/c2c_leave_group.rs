use crate::updates::handle_activity_notification;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::ChatEventInternal;
use group_canister::c2c_leave_group::{Response::*, *};
use ic_cdk_macros::update;
use tracing::instrument;
use types::ParticipantLeft;

// Called via the user's user canister
#[update]
#[instrument(level = "trace")]
fn c2c_leave_group(_args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_leave_group_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_leave_group_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    match runtime_state.data.participants.remove(caller) {
        true => {
            let event = ParticipantLeft { user_id: caller };
            runtime_state
                .data
                .events
                .push_event(ChatEventInternal::ParticipantLeft(Box::new(event)), now);

            handle_activity_notification(runtime_state);

            Success(SuccessResult {})
        }
        false => CallerNotInGroup,
    }
}
