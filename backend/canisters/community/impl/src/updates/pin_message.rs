use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::pin_message::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use types::PushEventResult;

#[update(msgpack = true)]
#[trace]
fn pin_message(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| pin_message_impl(args, true, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[update(msgpack = true)]
#[trace]
fn unpin_message(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| pin_message_impl(args, false, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn pin_message_impl(args: Args, pin: bool, state: &mut RuntimeState) -> Result<PushEventResult, OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let user_id = state.data.members.get_verified_member(caller)?.user_id;

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();

        let result = if pin {
            channel.chat.pin_message(user_id, args.message_index, now)?
        } else {
            channel.chat.unpin_message(user_id, args.message_index, now)?
        };

        handle_activity_notification(state);
        Ok(result)
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
