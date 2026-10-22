use crate::{CanisterToRefund, RuntimeState, jobs, mutate_state};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, ChatId, OCResult};
use utils::canister::{start, stop, uninstall};

pub(crate) fn delete_group(chat_id: ChatId, state: &mut RuntimeState) -> OCResult {
    if state.data.local_groups.delete(&chat_id) {
        let canister_id = chat_id.into();
        // The group is gone, so there is no point sending it the events still queued for it
        state.data.group_event_sync_queue.take(&canister_id);
        spawn_uninstall_then_refund_canister(canister_id);
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}

// Uninstalls the canister of a deleted group or community, then queues it to have its cycles
// refunded to the CyclesDispenser. The canister itself is never deleted, since that would destroy
// the cycles which can't yet be refunded (see the refund job), which the IC may in future let us
// recover.
pub(crate) fn spawn_uninstall_then_refund_canister(canister_id: CanisterId) {
    ic_cdk::futures::spawn_migratory(async move {
        // Stopping the canister lets the calls it has in progress finish before it is uninstalled,
        // one of which is the call by which a group or community deletes itself. If it fails to
        // stop, those calls are rejected when the canister is uninstalled.
        let _ = stop(canister_id).await;

        // If this fails, the refund job uninstalls the canister instead. It's started again once
        // empty so that callers are told it has no code, from which they know it's gone, rather
        // than that it's stopped, which they retry.
        if uninstall(canister_id).await.is_ok() {
            let _ = start(canister_id).await;
        }

        mutate_state(|state| {
            state.data.cycles_refund_queue.push_back(CanisterToRefund {
                canister_id,
                attempt: 0,
                retry_after: 0,
                return_to_pool: false,
            });
            jobs::refund_cycles::start_job_if_required(state, None);
        });
    });
}
