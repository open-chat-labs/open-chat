use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::cancel_invites::{Response::*, *};
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn cancel_invites(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| cancel_invites_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn cancel_invites_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;

    state.data.chat.cancel_invites(user_id, args.user_ids, state.env.now())?;

    handle_activity_notification(state);
    Ok(())
}
