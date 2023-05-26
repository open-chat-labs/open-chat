use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_delete_group::{Response::*, *};
use types::CanisterId;
use utils::canister::{delete, stop};

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| c2c_delete_group_impl(args, state))
}

fn c2c_delete_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.local_groups.delete(&args.chat_id) {
        ic_cdk::spawn(delete_canister(args.chat_id.into()));
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
