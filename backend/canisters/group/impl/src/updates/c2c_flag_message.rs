use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_flag_message::*;
use oc_error_codes::OCErrorCode;
use types::{ModerationCategories, OCResult};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_flag_message(args: Args) -> Response {
    execute_update(|state| c2c_flag_message_impl(args, state)).into()
}

fn c2c_flag_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let categories = ModerationCategories::from_bits(args.flags).ok_or(OCErrorCode::InvalidRequest)?;
    let now = state.env.now();

    state
        .data
        .chat
        .events
        .flag_message(args.thread_root_message_index, args.message_id, categories, now)?;

    handle_activity_notification(state);
    Ok(())
}
