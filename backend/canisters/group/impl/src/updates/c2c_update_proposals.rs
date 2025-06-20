use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_update_proposals::*;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
async fn c2c_update_proposals(args: Args) -> Response {
    execute_update(|state| c2c_update_proposals_impl(args, state)).into()
}

fn c2c_update_proposals_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();

    if state.data.chat.events.update_proposals(user_id, args.proposals, now) {
        handle_activity_notification(state);
    }
    Ok(())
}
