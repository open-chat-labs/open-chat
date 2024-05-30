use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::cancel_invites::{Response::*, *};
use group_chat_core::CancelInvitesResult;
use ic_cdk::update;

#[update]
#[trace]
fn cancel_invites(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| cancel_invites_impl(args, state))
}

fn cancel_invites_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user_id) = state.data.lookup_user_id(caller) {
        let now = state.env.now();
        match state.data.chat.cancel_invites(user_id, args.user_ids, now) {
            CancelInvitesResult::Success => Success,
            CancelInvitesResult::UserSuspended => UserSuspended,
            CancelInvitesResult::NotAuthorized | CancelInvitesResult::UserNotInGroup => NotAuthorized,
        }
    } else {
        UserNotInGroup
    }
}
