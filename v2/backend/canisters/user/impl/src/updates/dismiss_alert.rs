use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use tracing::instrument;
use types::AlertDetails;
use user_canister::dismiss_alert::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn dismiss_alert(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| dismiss_alert_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn dismiss_alert_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let now = runtime_state.env.now();
    if let Some(alert) = runtime_state.data.alerts.remove(args.alert_id) {
        if let AlertDetails::GroupDeleted(group_deleted) = alert.details {
            // Actually remove the group reference at this point
            runtime_state.data.group_chats.remove(group_deleted.chat_id, now);
        }
        Success
    } else {
        AlertNotFound
    }
}
