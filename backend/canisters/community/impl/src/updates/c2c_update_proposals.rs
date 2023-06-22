use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_update_proposals::{Response::*, *};

#[update_msgpack]
#[trace]
async fn c2c_update_proposals(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_update_proposals_impl(args, state))
}

fn c2c_update_proposals_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            if channel.chat.members.get(&member.user_id).is_none() {
                return UserNotInChannel;
            }

            channel
                .chat
                .events
                .update_proposals(member.user_id, args.proposals, state.env.now());

            handle_activity_notification(state);

            Success
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
