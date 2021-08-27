use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::c2c_mark_active;
use types::{CanisterId, Milliseconds};

mod add_participants;
mod c2c_join_group;
mod mark_read;
mod remove_participant;
mod send_message;

// If needed, notify the group index canister that there has been activity in this group
pub fn handle_activity_notification() {
    RUNTIME_STATE.with(|state| handle_activity_notification_impl(state.borrow_mut().as_mut().unwrap()));
}

fn handle_activity_notification_impl(runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let mark_active_duration = runtime_state.data.mark_active_duration;

    let requires_notification = runtime_state
        .data
        .activity_notification_state
        .start_if_required(now, mark_active_duration);
    if requires_notification {
        ic_cdk::block_on(call_group_index_canister(
            runtime_state.data.group_index_canister_id,
            mark_active_duration,
        ));
    }

    async fn call_group_index_canister(canister_id: CanisterId, mark_active_duration: Milliseconds) {
        let args = c2c_mark_active::Args {
            duration: mark_active_duration,
        };
        let response = group_index_canister_client::c2c_mark_active(canister_id, &args).await;
        RUNTIME_STATE.with(|state| handle_response(response.is_ok(), state.borrow_mut().as_mut().unwrap()));
    }

    fn handle_response(success: bool, runtime_state: &mut RuntimeState) {
        if success {
            let now = runtime_state.env.now();
            runtime_state.data.activity_notification_state.mark_succeeded(now);
        } else {
            runtime_state.data.activity_notification_state.mark_failed();
        }
    }
}
