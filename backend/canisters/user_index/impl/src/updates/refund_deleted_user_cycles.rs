use crate::guards::caller_is_platform_operator;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserIndexEvent;
use types::CanisterId;
use user_index_canister::refund_deleted_user_cycles::*;

const BATCH_SIZE: usize = 1000;

// Sends the cycles still held by deleted users' uninstalled canisters to the CyclesDispenser.
// Users are deleted by their LocalUserIndex, which refunds the cycles as part of the deletion,
// so this only needs calling to catch up on users deleted before that was the case.
#[update(guard = "caller_is_platform_operator", candid = true, msgpack = true)]
#[trace]
fn refund_deleted_user_cycles(_args: Args) -> Response {
    mutate_state(|state| {
        // Removed bots are in `deleted_users` too but have no canister, and users on MultiUser
        // canisters share them with other users, so neither have anything to refund
        let canister_ids: Vec<CanisterId> = state
            .data
            .deleted_users
            .iter()
            .filter(|u| u.user_id.is_canister() && u.user_id.index() == 0)
            .map(|u| u.user_id.canister_id())
            .collect();

        for batch in canister_ids.chunks(BATCH_SIZE) {
            state.push_event_to_all_local_user_indexes(UserIndexEvent::RefundDeletedUserCycles(batch.to_vec()), None);
        }

        Response::Success(canister_ids.len() as u32)
    })
}
