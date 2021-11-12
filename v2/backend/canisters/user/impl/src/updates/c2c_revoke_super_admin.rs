use crate::guards::caller_is_user_index;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::ChatId;
use user_canister::c2c_revoke_super_admin::{Response::*, *};

#[update(guard = "caller_is_user_index")]
#[trace]
async fn c2c_revoke_super_admin(_args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = RUNTIME_STATE.with(|state| prepare(state.borrow().as_ref().unwrap()));

    RUNTIME_STATE.with(|state| commit(&prepare_result.group_ids, state.borrow_mut().as_mut().unwrap()))
}

struct PrepareResult {
    group_ids: Vec<ChatId>,
}

fn prepare(runtime_state: &RuntimeState) -> PrepareResult {
    let group_ids = runtime_state
        .data
        .group_chats
        .iter()
        .filter(|g| g.is_super_admin)
        .map(|g| g.chat_id)
        .collect();

    PrepareResult { group_ids }
}

fn commit(_group_ids: &[ChatId], runtime_state: &mut RuntimeState) -> Response {
    for group in runtime_state.data.group_chats.iter_mut() {
        group.is_super_admin = false;
    }

    runtime_state.data.is_super_admin = false;
    Success
}
