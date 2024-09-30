use crate::{model::channels::MuteChannelResult, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::toggle_mute_notifications::{Response::*, *};

#[update(candid = true, msgpack = true)]
#[trace]
fn toggle_mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| toggle_mute_notifications_impl(args, state))
}

fn toggle_mute_notifications_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    let now = state.env.now();

    match state.data.members.get_mut(caller) {
        Some(member) if member.suspended.value => UserSuspended,
        Some(member) if member.lapsed.value => UserLapsed,
        Some(member) => {
            let updated = if let Some(channel_id) = args.channel_id {
                if let Some(channel) = state.data.channels.get_mut(&channel_id) {
                    match channel.mute_notifications(args.mute, member.user_id, now) {
                        MuteChannelResult::Success => true,
                        MuteChannelResult::Unchanged => false,
                        MuteChannelResult::UserNotFound => return UserNotInChannel,
                    }
                } else {
                    return ChannelNotFound;
                }
            } else {
                // Mute (or unmute) all channels
                let mut updated = false;
                for channel in state.data.channels.iter_mut() {
                    let result = channel.mute_notifications(args.mute, member.user_id, now);
                    if matches!(result, MuteChannelResult::Success) {
                        updated = true;
                    }
                }
                updated
            };

            if updated {
                let user_id = member.user_id;
                state.data.mark_community_updated_in_user_canister(user_id);
            }
            Success
        }
        None => UserNotInCommunity,
    }
}
