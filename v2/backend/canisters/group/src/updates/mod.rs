use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::Deserialize;
use shared::c2c::call_with_logging;
use shared::types::CanisterId;

mod mark_read;
mod send_message;

// If needed, notify the group index canister that there has been activity in this group
pub fn handle_activity_notification() {
    RUNTIME_STATE.with(|state| handle_activity_notification_impl(state.borrow_mut().as_mut().unwrap()));
}

#[derive(CandidType)]
struct NotifyActivityArgs {}

#[derive(Deserialize)]
enum NotifyActivityResponse {
    Success,
    ChatNotFound,
}

fn handle_activity_notification_impl(runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();

    let requires_notification = runtime_state.data.activity_notification_state.start_if_required(now);
    if requires_notification {
        ic_cdk::block_on(call_group_index_canister(runtime_state.data.group_index_canister_id));
    }

    async fn call_group_index_canister(canister_id: CanisterId) {
        let args = NotifyActivityArgs {};
        let response: CallResult<(NotifyActivityResponse,)> = call_with_logging(canister_id, "notify_activity", (args,)).await;
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
