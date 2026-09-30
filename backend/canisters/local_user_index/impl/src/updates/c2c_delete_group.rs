use crate::guards::caller_is_group_index;
use crate::{CanisterToRefund, RuntimeState, jobs, mutate_state};
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
        spawn_refund_then_delete_canister(args.chat_id.into());
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}

// Stops the canister of a deleted group or community, then queues it to be uninstalled and have its
// cycles refunded to the CyclesDispenser, as is done for a deleted user's canister, after which it
// is deleted. Deleting a canister destroys the cycles it holds, so that is left until last.
pub(crate) fn spawn_refund_then_delete_canister(canister_id: CanisterId) {
    utils::async_work::spawn_tracked(async move {
        // Stopping the canister lets the calls it has in progress finish before it is uninstalled,
        // one of which is the call by which a group or community deletes itself. If it fails to
        // stop, those calls are rejected when the canister is uninstalled.
        let _ = stop(canister_id).await;

        mutate_state(|state| {
            state.data.cycles_refund_queue.push_back(CanisterToRefund {
                canister_id,
                attempt: 0,
                retry_after: 0,
                delete_canister: true,
            });
            jobs::refund_cycles::start_job_if_required(state, None);
        });
    });
}

// Deletes a canister whose cycles have been refunded. Until then callers find it stopped or without
// its code, and from then on that it doesn't exist, which tells them the group or community is gone.
// TODO make this retry upon failure
pub(crate) fn spawn_delete_canister(canister_id: CanisterId) {
    utils::async_work::spawn_tracked(async move {
        let _ = stop(canister_id).await;
        let _ = delete(canister_id).await;
    });
}
