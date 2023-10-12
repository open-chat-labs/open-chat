use crate::guards::caller_is_proposals_bot;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use registry_canister::c2c_set_submitting_proposals_enabled::{Response::*, *};

#[update_msgpack(guard = "caller_is_proposals_bot")]
#[trace]
fn c2c_set_submitting_proposals_enabled(args: Args) -> Response {
    mutate_state(|state| c2c_set_submitting_proposals_enabled_impl(args, state))
}

fn c2c_set_submitting_proposals_enabled_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state
        .data
        .nervous_systems
        .set_submitting_proposals_enabled(args.governance_canister_id, args.enabled, now);

    Success
}
