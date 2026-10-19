use crate::guards::caller_is_storage_index_canister;
use crate::model::index_event_batch::EventToSync;
use crate::updates::c2c_sync_index::c2c_sync_index_impl;
use crate::updates::c2c_vault_sync::c2c_vault_sync_impl;
use crate::{RuntimeState, check_cycles_balance, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use std::mem::discriminant;
use storage_bucket_canister::c2c_storage_index::*;
use storage_bucket_canister::{StorageIndexEvent, c2c_sync_index, c2c_vault_sync};

// Must be fed by a single queue on the StorageIndex: the idempotency check keeps one high-water
// mark per sender, so a batch retried from a second queue after a later batch from the first had
// landed would be dropped as already seen
#[update(guard = "caller_is_storage_index_canister", msgpack = true)]
#[trace]
fn c2c_storage_index(args: Args) -> Response {
    check_cycles_balance();

    mutate_state(|state| c2c_storage_index_impl(args, state))
}

// The events are applied in the order they were sent. Each run of consecutive events of one kind
// goes to the handler of the endpoint which took that kind, so that nothing is reordered across
// kinds: a file's quarantine lands before its removal, say, where applying the removals first would
// lose the evidence.
fn c2c_storage_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let mut run: Vec<StorageIndexEvent> = Vec::new();
    for event in args.events {
        if !state
            .data
            .idempotency_checker
            .check(state.data.storage_index_canister_id, event.created_at, event.idempotency_id)
        {
            continue;
        }
        if run
            .last()
            .is_some_and(|last| discriminant(last) != discriminant(&event.value))
        {
            apply_run(std::mem::take(&mut run), state);
        }
        run.push(event.value);
    }
    apply_run(run, state);
    Response::Success
}

// Applies a run of events which are all of one kind
fn apply_run(run: Vec<StorageIndexEvent>, state: &mut RuntimeState) {
    if run.is_empty() {
        return;
    }
    let mut sync_args = c2c_sync_index::Args::default();
    let mut ops = Vec::new();
    for event in run {
        match event {
            StorageIndexEvent::UserAdded(user_id) => sync_args.users_added.push(user_id),
            StorageIndexEvent::UserRemoved(user_id) => sync_args.users_removed.push(user_id),
            StorageIndexEvent::AccessorRemoved(accessor_id) => sync_args.accessors_removed.push(accessor_id),
            StorageIndexEvent::FileToRemove(file_id) => sync_args.files_to_remove.push(file_id),
            StorageIndexEvent::VaultOp(op) => ops.push(*op),
        }
    }
    if ops.is_empty() {
        // The files removed are reported to the index as this canister's own events rather than in
        // the response, which carries nothing
        let c2c_sync_index::Response::Success(result) = c2c_sync_index_impl(sync_args, state);
        state
            .data
            .push_events_to_index(result.files_removed.into_iter().map(EventToSync::FileRemoved).collect());
    } else {
        // Quarantine failures are logged as they happen and otherwise go unreported, as from the
        // endpoint this replaces
        c2c_vault_sync_impl(c2c_vault_sync::Args { ops }, state);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::IdempotentEnvelope;
    use utils::env::test::TestEnv;

    fn envelope(created_at: u64, idempotency_id: u64, value: StorageIndexEvent) -> IdempotentEnvelope<StorageIndexEvent> {
        IdempotentEnvelope {
            created_at,
            idempotency_id,
            value,
        }
    }

    #[test]
    fn events_are_applied_in_the_order_sent_and_only_once() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(2)));

        let env = TestEnv::default();
        let now = env.now;
        let mut state = RuntimeState::new(Box::new(env), Data::new(Principal::anonymous(), now, true));
        let user = Principal::from_slice(&[1]);

        // Removed then added leaves the user present, which applying the removals after the
        // additions, as the endpoint this replaces does within a call, would not
        let args = Args {
            events: vec![
                envelope(now, 1, StorageIndexEvent::UserRemoved(user)),
                envelope(now, 2, StorageIndexEvent::UserAdded(user)),
            ],
        };
        c2c_storage_index_impl(args, &mut state);
        assert!(state.data.users.exists(&user));

        // The addition sent again after a later removal is one already seen, so is dropped
        let args = Args {
            events: vec![
                envelope(now + 1, 3, StorageIndexEvent::UserRemoved(user)),
                envelope(now, 2, StorageIndexEvent::UserAdded(user)),
            ],
        };
        c2c_storage_index_impl(args, &mut state);
        assert!(!state.data.users.exists(&user));
    }
}
