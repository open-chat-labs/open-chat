use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::c2c_mark_active;
use types::{CanisterId, Milliseconds};

mod add_participants;
mod block_user;
mod c2c_join_group;
mod c2c_leave_group;
mod delete_messages;
mod make_admin;
mod mark_read;
mod put_chunk;
mod remove_admin;
mod remove_participant;
mod send_message;
mod toggle_reaction;
mod unblock_user;
mod update_group;

// If needed, notify the group index canister that there has been activity in this group
fn handle_activity_notification(runtime_state: &mut RuntimeState) {
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
        let response = group_index_canister_c2c_client::c2c_mark_active(canister_id, &args).await;
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
