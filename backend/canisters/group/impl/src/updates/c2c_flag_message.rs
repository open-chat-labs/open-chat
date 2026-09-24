use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use group_canister::c2c_flag_message::*;
use oc_error_codes::OCErrorCode;
use types::{Caller, ModerationCategories, OCResult};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_flag_message(args: Args) -> Response {
    execute_update(|state| c2c_flag_message_impl(args, state)).into()
}

fn c2c_flag_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let categories = ModerationCategories::from_bits(args.flags).ok_or(OCErrorCode::InvalidRequest)?;
    let now = state.env.now();

    // The flags are commonly already set - the detecting canister sets them locally before
    // escalating, and the user_index re-asserts them with the deletion - which `flag_message`
    // reports as NoChange. That must not stop the deletion below.
    match state
        .data
        .chat
        .events
        .flag_message(args.thread_root_message_index, args.message_id, categories, now)
    {
        Ok(_) => (),
        Err(error) if error.matches_code(OCErrorCode::NoChange) => (),
        Err(error) => return Err(error),
    }

    // The flag is set first, in the same update, so the message is never deleted-but-unflagged:
    // that window is exactly when the sender can still read the content through
    // `deleted_message` and undelete it
    if args.delete {
        let results = state.data.chat.delete_messages(
            Caller::OCBot(OPENCHAT_BOT_USER_ID),
            args.thread_root_message_index,
            vec![args.message_id],
            true,
            now,
        )?;
        for result in results.into_iter().filter_map(|(_, result)| result.ok()) {
            state.push_bot_notification(result.bot_notification);
        }
    }

    handle_activity_notification(state);
    Ok(())
}
