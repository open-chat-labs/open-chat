use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::video_call_participants::{Response::*, *};

#[query(msgpack = true)]
fn video_call_participants(args: Args) -> Response {
    read_state(|state| video_call_participants_impl(args, state))
}

fn video_call_participants_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(member) = state.data.get_member(caller) else {
        return CallerNotInGroup;
    };

    if let Some(participants) = state.data.chat.events.video_call_participants(
        args.message_id,
        args.updated_since.unwrap_or_default(),
        member.min_visible_event_index(),
    ) {
        Success(participants)
    } else {
        VideoCallNotFound
    }
}
