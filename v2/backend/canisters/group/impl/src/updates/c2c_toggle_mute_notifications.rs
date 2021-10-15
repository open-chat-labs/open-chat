use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use group_canister::c2c_toggle_mute_notifications::{Response::*, *};
use ic_cdk_macros::update;
use tracing::instrument;

#[update]
#[instrument(level = "trace")]
fn toggle_mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| toggle_mute_notifications_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn toggle_mute_notifications_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    match runtime_state.data.participants.get_by_user_id_mut(&user_id) {
        Some(participant) => {
            participant.notifications_muted = args.mute;
            Success
        }
        None => CallerNotInGroup,
    }
}
