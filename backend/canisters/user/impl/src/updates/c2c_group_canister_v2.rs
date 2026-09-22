use crate::guards::caller_is_known_group_canister;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::IdempotentEnvelope;
use user_canister::c2c_group_canister_v2::*;

#[update(guard = "caller_is_known_group_canister", msgpack = true)]
#[trace]
fn c2c_group_canister_v2(args: Args) -> Response {
    execute_update(|state| c2c_group_canister_v2_impl(args, state))
}

// Only the events for this canister's own user apply
fn c2c_group_canister_v2_impl(args: Args, state: &mut RuntimeState) -> Response {
    let my_user_id = state.env.canister_id().into();
    let events = args
        .events
        .into_iter()
        .filter(|event| event.value.0 == my_user_id)
        .map(|event| IdempotentEnvelope {
            created_at: event.created_at,
            idempotency_id: event.idempotency_id,
            value: event.value.1,
        })
        .collect();

    super::c2c_group_canister::handle_events(events, state)
}
