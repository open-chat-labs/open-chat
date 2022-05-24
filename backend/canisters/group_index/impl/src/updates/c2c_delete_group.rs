use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use group_index_canister::c2c_delete_group::{Response::*, *};
use ic_cdk_macros::update;
use types::{CanisterId, ChatId};
use utils::canister::{delete, stop};

#[update]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| c2c_delete_group_impl(args, state))
}

fn c2c_delete_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let chat_id = ChatId::from(caller);
    let now = runtime_state.env.now();

    let deleted =
        runtime_state.data.private_groups.delete(&chat_id) || runtime_state.data.public_groups.delete(&chat_id).is_some();

    ic_cdk::spawn(delete_canister(caller));

    if deleted {
        runtime_state.data.canisters_requiring_upgrade.remove(&chat_id.into());
        runtime_state
            .data
            .deleted_groups
            .insert(chat_id, args.deleted_by, args.group_name, now);

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
