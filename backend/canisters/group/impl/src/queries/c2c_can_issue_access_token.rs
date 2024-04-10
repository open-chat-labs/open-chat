use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use group_canister::c2c_can_issue_access_token::*;
use types::{AccessTokenType, VideoCallType};

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_can_issue_access_token(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args: Args, state: &RuntimeState) -> bool {
    let Some(member) = state.data.chat.members.get(&args.user_id) else {
        return false;
    };

    match args.access_type {
        AccessTokenType::StartVideoCall => {
            state
                .data
                .chat
                .can_start_video_call(member, args.is_diamond, VideoCallType::Default)
        }
        AccessTokenType::StartVideoCallV2(vc) => state.data.chat.can_start_video_call(member, args.is_diamond, vc.call_type),
        AccessTokenType::JoinVideoCall | AccessTokenType::MarkVideoCallAsEnded => true,
    }
}
