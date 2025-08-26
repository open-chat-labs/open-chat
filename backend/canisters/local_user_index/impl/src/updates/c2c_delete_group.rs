use crate::guards::caller_is_group_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_delete_group::*;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult};
use utils::canister::{delete, stop};

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| c2c_delete_group_impl(args, state)).into()
}

fn c2c_delete_group_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if state.data.local_groups.delete(&args.chat_id) {
        spawn_delete_canister(args.chat_id.into());
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}

// TODO make this retry upon failure
pub(crate) fn spawn_delete_canister(canister_id: CanisterId) {
    ic_cdk::futures::spawn(async move {
        let _ = stop(canister_id).await;

        // Note: we are hoping the spec/implementation of delete_canister will change so that
        // the controller receives the remaining cycles from the deleted canister
        let _ = delete(canister_id).await;
    });
}
