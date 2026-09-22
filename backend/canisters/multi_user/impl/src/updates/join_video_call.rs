use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Achievement, OCResult, UserId};
use user_canister::{JoinVideoCall, UserCanisterEvent, join_video_call::*};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn join_video_call(args: Args) -> Response {
    mutate_state(|state| join_video_call_impl(args, state)).into()
}

fn join_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let canister_id = state.env.canister_id();
    let my_index = state.with_caller_user_mut(|my_index, user| {
        let my_user_id = UserId::new_indexed(canister_id, my_index);
        user_core::updates::join_video_call(user, &args, my_user_id, now).map(|()| my_index)
    })?;

    // The other user's canister is told as the User canister tells it
    // TODO: A user in this canister is dropped by `push_user_canister_event`, so their copy of the
    // chat must be updated directly, along with the rest of the video call handling
    state.push_user_canister_event(
        my_index,
        args.user_id,
        UserCanisterEvent::JoinVideoCall(Box::new(JoinVideoCall {
            message_id: args.message_id,
        })),
    );
    state.award_achievement_and_notify(my_index, Achievement::JoinedCall, now);
    Ok(())
}
