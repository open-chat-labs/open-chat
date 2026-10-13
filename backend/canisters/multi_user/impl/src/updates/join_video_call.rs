use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::{JoinVideoCall, UserCanisterEvent, join_video_call::*};
use types::{Achievement, OCResult};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn join_video_call(args: Args) -> Response {
    execute_update(|state| join_video_call_impl(args, state)).into()
}

fn join_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let data = &mut state.data;
    let dismissal = data
        .users
        .with_user_mut(my_index, |user| {
            user_core::updates::join_video_call(user, &args, my_user_id, &data.migrated_user_ids, now)
                .map(|()| user_core::updates::answered_dismissal(user, &args))
        })
        .expect("User not found")?;

    // this user has answered: any other device of theirs that is still ringing should stop
    if let Some(dismissal) = dismissal {
        state.push_notification(None, my_index, dismissal, now);
    }

    // The other user is told
    state.send_user_canister_event(
        my_index,
        args.user_id,
        UserCanisterEvent::JoinVideoCall(Box::new(JoinVideoCall {
            message_id: args.message_id,
        })),
    );
    state.award_achievement_and_notify(my_index, Achievement::JoinedCall, now);
    Ok(())
}
