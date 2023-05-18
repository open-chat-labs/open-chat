use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_update_proposals::{Response::*, *};
use types::ProposalStatusUpdate;

#[update_msgpack]
#[trace]
async fn c2c_update_proposals(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_update_proposals_impl(args, state))
}

fn c2c_update_proposals_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(user_id) = runtime_state.data.principal_to_user_id_map.get(&caller).copied() {
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
                        deadline: p.deadline,
                    },
                )
            })
            .collect();

        runtime_state
            .data
            .group_chat_core
            .events
            .update_proposals(user_id, updates, now);
        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
