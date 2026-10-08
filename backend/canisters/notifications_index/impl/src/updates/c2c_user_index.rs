use crate::guards::caller_is_user_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::UserIndexEvent;
use notifications_index_canister::c2c_user_index::*;
use stable_memory_map::StableMemoryMap;

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_user_index_impl(args, state))
}

fn c2c_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.user_index_canister_id, event.created_at, event.idempotency_id)
        {
            handle_event(event.value, state);
        }
    }
    Response::Success
}

fn handle_event(event: UserIndexEvent, state: &mut RuntimeState) {
    match event {
        UserIndexEvent::UserIdMigrated(ev) => {
            // Only users already cached need updating, any others are looked up from the UserIndex,
            // which returns their new id, when next needed
            if state.data.principal_to_user_id_map.contains_key(&ev.user_principal) {
                state.data.principal_to_user_id_map.insert(ev.user_principal, ev.new_user_id);
            }
            state.data.migrate_user_id(ev.old_user_id, ev.new_user_id);
        }
    }
}
