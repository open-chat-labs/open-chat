use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::cancel_invites::{Response::*, *};
use oc_error_codes::OCError;

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

fn cancel_invites_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let member = state.data.get_verified_member(caller)?;

    state
        .data
        .chat
        .cancel_invites(member.user_id(), args.user_ids, state.env.now())?;

    handle_activity_notification(state);
    Ok(())
}
