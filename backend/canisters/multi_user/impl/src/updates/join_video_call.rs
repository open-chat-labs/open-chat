use crate::guards::caller_is_hosted_user;
use crate::updates::c2c_user_canister_v2::receive_join_video_call;
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
    let (my_index, dismissal) = state.with_caller_user_mut(|my_index, user| {
        let my_user_id = UserId::new_indexed(canister_id, my_index);
        user_core::updates::join_video_call(user, &args, my_user_id, now)
            .map(|()| (my_index, user_core::updates::answered_dismissal(user, &args)))
    })?;

    // this user has answered: any other device of theirs that is still ringing should stop
    if let Some(dismissal) = dismissal {
        state.push_notification(None, my_index, dismissal, now);
    }

    // The other user is told as the User canister tells them: directly if they are in this canister
    if state.index_of_local_user(args.user_id).is_some() {
        let my_user_id = state.user_id(my_index);
        receive_join_video_call(args.message_id, my_user_id, args.user_id, now, state);
    } else {
        state.push_user_canister_event(
            my_index,
            args.user_id,
            UserCanisterEvent::JoinVideoCall(Box::new(JoinVideoCall {
                message_id: args.message_id,
            })),
        );
    }
    state.award_achievement_and_notify(my_index, Achievement::JoinedCall, now);
    Ok(())
}
