use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::join_video_call::{Response::*, *};
use group_chat_core::JoinVideoCallResult;
use ic_cdk_macros::update;

#[update]
#[trace]
fn join_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| join_video_call_impl(args, state))
}

fn join_video_call_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();

    let user_id = match state.data.members.get(caller) {
        Some(member) if member.suspended.value => return UserSuspended,
        Some(member) => member.user_id,
        None => return UserNotInCommunity,
    };

    let now = state.env.now();

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        match channel.chat.join_video_call(user_id, args.message_index, now) {
            JoinVideoCallResult::Success => {
                handle_activity_notification(state);
                Success
            }
            JoinVideoCallResult::MessageNotFound => MessageNotFound,
            JoinVideoCallResult::CallNotInProgress => CallNotInProgress,
            JoinVideoCallResult::UserNotInGroup => UserNotInChannel,
            JoinVideoCallResult::AlreadyJoined => Success,
        }
    } else {
        ChannelNotFound
    }
}
