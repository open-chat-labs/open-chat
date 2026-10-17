use crate::guards::caller_is_storage_index_canister;
use crate::model::index_event_batch::EventToSync;
use crate::updates::c2c_sync_index::c2c_sync_index_impl;
use crate::updates::c2c_vault_sync::c2c_vault_sync_impl;
use crate::{RuntimeState, check_cycles_balance, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use storage_bucket_canister::c2c_storage_index::*;
use storage_bucket_canister::{StorageIndexEvent, c2c_sync_index, c2c_vault_sync};

#[update(guard = "caller_is_storage_index_canister", msgpack = true)]
#[trace]
fn c2c_storage_index(args: Args) -> Response {
    check_cycles_balance();

    mutate_state(|state| c2c_storage_index_impl(args, state))
}

// The sync events are applied together, in order, and then the vault ops, in order. The two
// endpoints this replaces are fed from separate queues, so there was never an ordering between
// the two kinds.
fn c2c_storage_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let mut sync_args = c2c_sync_index::Args::default();
    let mut vault_args = c2c_vault_sync::Args::default();
    for event in args.events {
        if !state
            .data
            .idempotency_checker
            .check(state.data.storage_index_canister_id, event.created_at, event.idempotency_id)
        {
            continue;
        }
        match event.value {
            StorageIndexEvent::UserAdded(user_id) => sync_args.users_added.push(user_id),
            StorageIndexEvent::UserRemoved(user_id) => sync_args.users_removed.push(user_id),
            StorageIndexEvent::AccessorRemoved(accessor_id) => sync_args.accessors_removed.push(accessor_id),
            StorageIndexEvent::FileToRemove(file_id) => sync_args.files_to_remove.push(file_id),
            StorageIndexEvent::VaultOp(op) => vault_args.ops.push(op),
        }
    }

    // The files removed are reported to the index as this canister's own events rather than in the
    // response, which carries nothing
    let c2c_sync_index::Response::Success(result) = c2c_sync_index_impl(sync_args, state);
    for file in result.files_removed {
        state.data.push_event_to_index(EventToSync::FileRemoved(file));
    }

    // Quarantine failures are logged as they happen and otherwise go unreported, as from the
    // endpoint this replaces
    c2c_vault_sync_impl(vault_args, state);

    Response::Success
}
