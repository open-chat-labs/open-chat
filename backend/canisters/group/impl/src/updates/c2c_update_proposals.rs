use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_update_proposals::{Response::*, *};
use types::OCResult;

#[update(msgpack = true)]
#[trace]
async fn c2c_update_proposals(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| c2c_update_proposals_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn c2c_update_proposals_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();

    state.data.chat.events.update_proposals(user_id, args.proposals, now);
    handle_activity_notification(state);
    Ok(())
}
