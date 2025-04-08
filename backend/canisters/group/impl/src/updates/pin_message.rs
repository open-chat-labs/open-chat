use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::pin_message_v2::{Response::*, *};
use types::{OCResult, PushEventResult};

#[update(msgpack = true)]
#[trace]
fn pin_message_v2(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| pin_message_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn pin_message_impl(args: Args, state: &mut RuntimeState) -> OCResult<PushEventResult> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let user_id = state.data.get_verified_member(caller)?.user_id();
    let now = state.env.now();
    let result = state.data.chat.pin_message(user_id, args.message_index, now)?;

    handle_activity_notification(state);
    Ok(result)
}
