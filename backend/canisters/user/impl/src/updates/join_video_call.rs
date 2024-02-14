use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::JoinVideoCallResult;
use ic_cdk_macros::update;
use types::{EventIndex, UserId};
use user_canister::{
    join_video_call::{Response::*, *},
    JoinVideoCall, UserCanisterEvent,
};

#[update]
#[trace]
fn join_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| join_video_call_impl(args, state))
}

fn join_video_call_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    if state.data.blocked_users.contains(&args.user_id) {
        return UserBlocked;
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let now = state.env.now();
        let my_user_id: UserId = state.env.canister_id().into();

        match chat
            .events
            .join_video_call(my_user_id, args.message_index, EventIndex::default(), now)
        {
            JoinVideoCallResult::Success => {
                state.push_user_canister_event(
                    args.user_id.into(),
                    UserCanisterEvent::JoinVideoCall(Box::new(JoinVideoCall {
                        message_index: args.message_index,
                    })),
                );

                Success
            }
            JoinVideoCallResult::MessageNotFound => MessageNotFound,
            JoinVideoCallResult::CallNotInProgress => CallNotInProgress,
            JoinVideoCallResult::AlreadyJoined => Success,
        }
    } else {
        ChatNotFound
    }
}
