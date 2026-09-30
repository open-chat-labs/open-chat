use crate::guards::caller_is_group_index;
use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_delete_group::*;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult};
use utils::canister::{delete, stop, uninstall};

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_delete_group(args: Args) -> Response {
    mutate_state(|state| c2c_delete_group_impl(args, state)).into()
}

fn c2c_delete_group_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if state.data.local_groups.delete(&args.chat_id) {
        spawn_uninstall_canister(args.chat_id.into());
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}

// Uninstalls the canister of a deleted group or community, then queues it to have its cycles
// refunded to the CyclesDispenser, as is done for a deleted user's canister. Deleting a canister
// destroys the cycles it holds, so that is left until they have been refunded.
// TODO make this retry upon failure
pub(crate) fn spawn_uninstall_canister(canister_id: CanisterId) {
    utils::async_work::spawn_tracked(async move {
        // Stopping the canister lets the calls it has in progress finish first, one of which is
        // the call by which a group or community deletes itself. If it fails to stop, those
        // calls are rejected when the canister is uninstalled.
        let _ = stop(canister_id).await;

        if uninstall(canister_id).await.is_ok() {
            mutate_state(|state| jobs::refund_cycles::queue_then_delete(canister_id, state));
        } else {
            // Its cycles can't be refunded while it has its code, so they go with the canister
            let _ = delete(canister_id).await;
        }
    });
}

// Deletes a canister whose cycles have been refunded. Until then callers find it has no code,
// and from then on that it doesn't exist, which is what tells them the group or community is gone.
pub(crate) fn spawn_delete_canister(canister_id: CanisterId) {
    utils::async_work::spawn_tracked(async move {
        let _ = stop(canister_id).await;
        let _ = delete(canister_id).await;
    });
}
