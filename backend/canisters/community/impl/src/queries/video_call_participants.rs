use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::video_call_participants::{Response::*, *};

#[query(msgpack = true)]
fn video_call_participants(args: Args) -> Response {
    read_state(|state| video_call_participants_impl(args, state))
}

fn video_call_participants_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(user_id) = state.data.members.lookup_user_id(caller) else {
        return UserNotInCommunity;
    };

    let Some(channel) = state.data.channels.get(&args.channel_id) else {
        return ChannelNotFound;
    };

    let Some(member) = channel.chat.members.get(&user_id) else {
        return UserNotInChannel;
    };

    if let Some(participants) = channel.chat.events.video_call_participants(
        args.message_id,
        args.updated_since.unwrap_or_default(),
        member.min_visible_event_index(),
    ) {
        Success(participants)
    } else {
        VideoCallNotFound
    }
}
