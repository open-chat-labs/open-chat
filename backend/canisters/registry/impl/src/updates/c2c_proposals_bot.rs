use crate::guards::caller_is_proposals_bot;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use registry_canister::c2c_proposals_bot::*;
use registry_canister::{ProposalsBotEvent, SetSubmittingProposalsEnabled};

#[update(guard = "caller_is_proposals_bot", msgpack = true)]
#[trace]
fn c2c_proposals_bot(args: Args) -> Response {
    mutate_state(|state| c2c_proposals_bot_impl(args, state))
}

fn c2c_proposals_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.proposals_bot_canister_id, event.created_at, event.idempotency_id)
        {
            match event.value {
                ProposalsBotEvent::SetSubmittingProposalsEnabled(ev) => set_submitting_proposals_enabled(ev, state),
            }
        }
    }
    Response::Success
}

fn set_submitting_proposals_enabled(args: SetSubmittingProposalsEnabled, state: &mut RuntimeState) {
    let now = state.env.now();
    state
        .data
        .nervous_systems
        .set_submitting_proposals_enabled(args.governance_canister_id, args.enabled, now);
}
