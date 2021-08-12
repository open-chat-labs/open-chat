use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::updates::notify_activity;
use types::CanisterId;

mod add_participants;
mod join_group;
mod mark_read;
mod send_message;

// If needed, notify the group index canister that there has been activity in this group
pub fn handle_activity_notification() {
    RUNTIME_STATE.with(|state| handle_activity_notification_impl(state.borrow_mut().as_mut().unwrap()));
}

fn handle_activity_notification_impl(runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();

    let requires_notification = runtime_state.data.activity_notification_state.start_if_required(now);
    if requires_notification {
        ic_cdk::block_on(call_group_index_canister(runtime_state.data.group_index_canister_id));
    }

    async fn call_group_index_canister(canister_id: CanisterId) {
        let response = group_index_canister_client::notify_activity(canister_id, &notify_activity::Args {}).await;
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
