use crate::guards::caller_is_group_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_delete_group::{Response::*, *};
use local_user_index_canister::LocalGroupIndexEvent;
use rand::RngCore;
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::{delete, stop};

#[update(guard = "caller_is_group_index_canister", msgpack = true)]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| c2c_delete_group_impl(args, state))
}

fn c2c_delete_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.local_groups.delete(&args.chat_id) {
        state.data.local_user_index_sync_queue.push(IdempotentEnvelope {
            created_at: state.env.now(),
            idempotency_id: state.env.rng().next_u64(),
            value: LocalGroupIndexEvent::GroupRemoved(args.chat_id),
        });
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
