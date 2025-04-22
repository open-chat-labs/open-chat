use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use group_canister::video_call_participants::{Response::*, *};
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
    let member = state.get_calling_member(false)?;

    if let Some(participants) = state.data.chat.events.video_call_participants(
        args.message_id,
        args.updated_since.unwrap_or_default(),
        member.min_visible_event_index(),
    ) {
        Ok(participants)
    } else {
        Err(OCErrorCode::VideoCallNotFound.into())
    }
}
