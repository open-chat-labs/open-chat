use crate::guards::caller_is_group_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_delete_group::{Response::*, *};
use types::CanisterId;
use utils::canister::{delete, stop};

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| c2c_delete_group_impl(args, state))
}

fn c2c_delete_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.local_groups.delete(&args.chat_id) {
        ic_cdk::futures::spawn(delete_canister(args.chat_id.into()));
        Success
    } else {
        ChatNotFound
    }
}

// TODO make this retry upon failure
async fn delete_canister(canister_id: CanisterId) {
    let _ = stop(canister_id).await;

    // Note: we are hoping the spec/implementation of delete_canister will change so that
    // the controller receives the remaining cycles from the deleted canister
    let _ = delete(canister_id).await;
}
