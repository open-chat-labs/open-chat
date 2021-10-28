//use crate::model::public_groups::UpdateGroupResult;
use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::c2c_delete_group::{Response::*, *};
use ic_cdk_macros::update;
use tracing::instrument;
use types::{CanisterId, ChatId};
use utils::canister::{delete, stop};

#[update]
#[instrument(level = "trace")]
fn c2c_delete_group(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_delete_group_impl(state.borrow_mut().as_mut().unwrap()))
}

fn c2c_delete_group_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let chat_id = ChatId::from(caller);

    let mut deleted = runtime_state.data.private_groups.delete(&chat_id);

    if !deleted {
        deleted = runtime_state.data.public_groups.delete(&chat_id);
    }

    ic_cdk::block_on(delete_canister(caller));

    if deleted {
        runtime_state.data.canisters_requiring_upgrade.remove(&chat_id);
        Success
    } else {
        ChatNotFound
    }
}

async fn delete_canister(canister_id: CanisterId) {
    let _ = stop(canister_id).await;

    // Note: we are hoping the spec/implementation of delete_canister will change so that
    // the controller receives the remaining cycles from the deleted canister
    let _ = delete(canister_id).await;
}
