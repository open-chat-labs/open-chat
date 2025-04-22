use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::video_call_participants::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{OCResult, VideoCallParticipants};

#[query(msgpack = true)]
fn video_call_participants(args: Args) -> Response {
    match read_state(|state| video_call_participants_impl(args, state)) {
        Ok(participants) => Success(participants),
        Err(error) => Error(error),
    }
}

fn video_call_participants_impl(args: Args, state: &RuntimeState) -> OCResult<VideoCallParticipants> {
    let user_id = state.get_caller_user_id()?;
    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let channel_member = channel.chat.members.get(&user_id).ok_or(OCErrorCode::InitiatorNotInChat)?;

    channel
        .chat
        .events
        .video_call_participants(
            args.message_id,
            args.updated_since.unwrap_or_default(),
            channel_member.min_visible_event_index(),
        )
        .ok_or(OCErrorCode::VideoCallNotFound.into())
}
