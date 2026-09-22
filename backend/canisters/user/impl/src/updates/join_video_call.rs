use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Achievement, OCResult};
use user_canister::{JoinVideoCall, UserCanisterEvent, join_video_call::*};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn join_video_call(args: Args) -> Response {
    execute_update(|state| join_video_call_impl(args, state).into())
}

fn join_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let my_user_id = state.env.canister_id().into();
    let now = state.env.now();
    user_core::updates::join_video_call(&mut state.data.user, &args, my_user_id, now)?;

    state.push_user_canister_event(
        args.user_id,
        UserCanisterEvent::JoinVideoCall(Box::new(JoinVideoCall {
            message_id: args.message_id,
        })),
    );
    state.award_achievement_and_notify(Achievement::JoinedCall, now);
    Ok(())
}
