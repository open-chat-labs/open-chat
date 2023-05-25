use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_delete_community::{Response::*, *};
use types::CanisterId;
use utils::canister::{delete, stop};

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_delete_community(args: Args) -> Response {
    mutate_state(|state| c2c_delete_community_impl(args, state))
}

fn c2c_delete_community_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.local_communities.delete(&args.community_id) {
        ic_cdk::spawn(delete_canister(args.community_id.into()));
        Success
    } else {
        CommunityNotFound
    }
}

async fn delete_canister(canister_id: CanisterId) {
    let _ = stop(canister_id).await;

    // Note: we are hoping the spec/implementation of delete_canister will change so that
    // the controller receives the remaining cycles from the deleted canister
    let _ = delete(canister_id).await;
}
