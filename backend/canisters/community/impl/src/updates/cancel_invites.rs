use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::cancel_invites::{Response::*, *};
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

    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = state.env.now();
        if let Some(channel_id) = args.channel_id {
            if let Some(channel) = state.data.channels.get_mut(&channel_id) {
                match channel.chat.cancel_invites(member.user_id, args.user_ids, now) {
                    CancelInvitesResult::Success => Success,
                    CancelInvitesResult::UserSuspended => UserSuspended,
                    CancelInvitesResult::NotAuthorized | CancelInvitesResult::UserNotInGroup => NotAuthorized,
                }
            } else {
                ChannelNotFound
            }
        } else if member.role.can_invite_users(&state.data.permissions) {
            for user_id in args.user_ids {
                if state.data.invited_users.remove(&user_id, now).is_some() {
                    for channel in state.data.channels.iter_mut() {
                        channel.chat.cancel_invite_unchecked(&user_id, now);
                    }
                }
            }
            Success
        } else {
            NotAuthorized
        }
    } else {
        UserNotInCommunity
    }
}
