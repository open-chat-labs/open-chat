use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::cancel_invites::{Response::*, *};
use group_chat_core::CancelInvitesResult;

#[update(candid = true, msgpack = true)]
#[trace]
fn cancel_invites(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| cancel_invites_impl(args, state))
}

fn cancel_invites_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(member) = state.data.members.get(caller) else {
        return NotAuthorized;
    };

    if member.suspended.value {
        return UserSuspended;
    } else if member.lapsed.value {
        return UserLapsed;
    }

    let now = state.env.now();

    if let Some(channel_id) = args.channel_id {
        let Some(channel) = state.data.channels.get_mut(&channel_id) else {
            return ChannelNotFound;
        };

        match channel.chat.cancel_invites(member.user_id, args.user_ids, now) {
            CancelInvitesResult::Success => (),
            CancelInvitesResult::UserNotInGroup => return NotAuthorized,
            CancelInvitesResult::UserSuspended => return UserSuspended,
            CancelInvitesResult::NotAuthorized => return NotAuthorized,
            CancelInvitesResult::UserLapsed => return UserLapsed,
        }
    } else {
        if !member.role.can_invite_users(&state.data.permissions) {
            return NotAuthorized;
        }

        for user_id in args.user_ids {
            if state.data.invited_users.remove(&user_id, now).is_some() {
                for channel in state.data.channels.iter_mut() {
                    channel.chat.cancel_invite_unchecked(&user_id, now);
                }
            }
        }
    }

    handle_activity_notification(state);
    Success
}
