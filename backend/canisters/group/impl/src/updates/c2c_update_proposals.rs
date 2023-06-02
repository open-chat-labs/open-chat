use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_update_proposals::{Response::*, *};

#[update_msgpack]
#[trace]
async fn c2c_update_proposals(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_update_proposals_impl(args, state))
}

fn c2c_update_proposals_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user_id) = state.data.lookup_user_id(caller) {
        let now = state.env.now();

        state.data.chat.events.update_proposals(user_id, args.proposals, now);
        handle_activity_notification(state);

        Success
    } else {
        CallerNotInGroup
    }
}
