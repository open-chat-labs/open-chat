use crate::guards::caller_is_platform_operator;
use crate::nns_registry::{self, RoutingTable};
use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserIndexEvent;
use tracing::warn;
use types::CanisterId;
use user_index_canister::refund_deleted_user_cycles::*;

const BATCH_SIZE: usize = 1000;

// Sends the cycles still held by deleted users' uninstalled canisters to the CyclesDispenser.
// Users are deleted by their LocalUserIndex, which refunds the cycles as part of the deletion,
// so this only needs calling to catch up on users deleted before that was the case.
#[update(guard = "caller_is_platform_operator", candid = true, msgpack = true)]
#[trace]
async fn refund_deleted_user_cycles(_args: Args) -> Response {
    run().await
}

pub(crate) async fn run() -> Response {
    // Each LocalUserIndex only controls the canisters on its own subnet, so the IC registry's
    // routing table is used to send each canister to the right one
    let routing_table = match nns_registry::routing_table().await {
        Ok(routing_table) => Some(routing_table),
        Err(error) => {
            warn!(
                ?error,
                "Failed to fetch the routing table, sending the canisters to every LocalUserIndex"
            );
            None
        }
    };

    mutate_state(|state| refund_deleted_user_cycles_impl(routing_table, state))
}

fn refund_deleted_user_cycles_impl(routing_table: Option<RoutingTable>, state: &mut RuntimeState) -> Response {
    // Removed bots are in `deleted_users` too but have no canister, and users on MultiUser
    // canisters share them with other users, so neither have anything to refund
    let canister_ids: Vec<CanisterId> = state
        .data
        .deleted_users
        .iter()
        .filter(|u| u.user_id.is_canister() && u.user_id.index() == 0)
        .map(|u| u.user_id.canister_id())
        .collect();
    let canisters = canister_ids.len() as u32;
    state.data.deleted_user_cycles_refund_queued = true;

    let local_user_indexes: Vec<CanisterId> = state.data.local_index_map.canisters().copied().collect();
    let (grouped, unrouted) = match routing_table {
        Some(routing_table) => routing_table.group_by_subnet_of(canister_ids, &local_user_indexes),
        None => (Default::default(), canister_ids),
    };

    for (local_user_index, canister_ids) in grouped {
        for batch in canister_ids.chunks(BATCH_SIZE) {
            state
                .data
                .user_index_event_sync_queue
                .push(local_user_index, UserIndexEvent::RefundDeletedUserCycles(batch.to_vec()));
        }
    }

    // Any which couldn't be routed go to every LocalUserIndex, which each drop the ones they
    // don't control
    let canisters_not_routed = unrouted.len() as u32;
    for batch in unrouted.chunks(BATCH_SIZE) {
        for local_user_index in local_user_indexes.iter() {
            state
                .data
                .user_index_event_sync_queue
                .push(*local_user_index, UserIndexEvent::RefundDeletedUserCycles(batch.to_vec()));
        }
    }

    jobs::sync_events_to_local_user_index_canisters::try_run_now(state);

    Response::Success(SuccessResult {
        canisters,
        canisters_not_routed,
    })
}
