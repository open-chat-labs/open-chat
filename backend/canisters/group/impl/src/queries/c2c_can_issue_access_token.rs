use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use group_canister::c2c_can_issue_access_token::*;
use types::AccessTokenType;

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_can_issue_access_token(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args: Args, state: &RuntimeState) -> bool {
    let joining = matches!(args.access_type, AccessTokenType::JoinVideoCall);

    let Some(member) = state.data.chat.members.get(&args.user_id) else {
        return false;
    };

    return joining || (args.is_diamond && member.role.is_permitted(state.data.chat.permissions.start_video_call));
}
