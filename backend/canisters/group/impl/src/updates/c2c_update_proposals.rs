use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_update_proposals::{Response::*, *};
use types::ProposalStatusUpdate;

#[update_msgpack]
#[trace]
async fn update_proposals(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_proposals_impl(args, state))
}

fn update_proposals_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let now = runtime_state.env.now();

        let updates = args
            .proposals
            .into_iter()
            .map(|p| {
                (
                    p.message_id,
                    ProposalStatusUpdate {
                        status: p.status,
                        reward_status: p.reward_status,
                        latest_tally: p.latest_tally,
                    },
                )
            })
            .collect();

        runtime_state.data.events.update_proposals(participant.user_id, updates, now);

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
