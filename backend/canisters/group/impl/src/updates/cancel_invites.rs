use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::cancel_invites::{Response::*, *};
use group_chat_core::CancelInvitesResult;

#[update(candid = true, msgpack = true)]
#[trace]
fn cancel_invites(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| cancel_invites_impl(args, state))
}

fn cancel_invites_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(user_id) = state.data.lookup_user_id(caller) else {
        return NotAuthorized;
    };

    if !matches!(
        state.data.chat.cancel_invites(user_id, args.user_ids, state.env.now()),
        CancelInvitesResult::Success
    ) {
        return NotAuthorized;
    };

    handle_activity_notification(state);
    Success
}
