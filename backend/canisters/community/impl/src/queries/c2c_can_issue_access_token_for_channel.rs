use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use community_canister::c2c_can_issue_access_token_for_channel::*;
use types::AccessTokenType;

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_can_issue_access_token_for_channel(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_for_channel_impl(args, state))
}

fn c2c_can_issue_access_token_for_channel_impl(args: Args, state: &RuntimeState) -> bool {
    let Some(channel) = state.data.channels.get(&args.channel_id) else {
        return false;
    };

    let Some(member) = channel.chat.members.get(&args.user_id) else {
        return false;
    };

    match args.access_type {
        AccessTokenType::StartVideoCall => {
            args.is_diamond && member.role.is_permitted(channel.chat.permissions.start_video_call)
        }
        AccessTokenType::JoinVideoCall | AccessTokenType::MarkVideoCallAsEnded => true,
    }
}
