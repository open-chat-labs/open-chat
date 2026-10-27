use crate::RuntimeState;
use crate::activity_notifications::handle_activity_notification;
use community_canister::FlagMessage as Args;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::{Caller, ModerationCategories, OCResult};

pub(crate) fn c2c_flag_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let categories = ModerationCategories::from_bits(args.flags).ok_or(OCErrorCode::InvalidRequest)?;
    let channel = state
        .data
        .channels
        .get_mut(&args.channel_id)
        .ok_or(OCErrorCode::ChatNotFound)?;
    let now = state.env.now();

    // The flags are commonly already set - the detecting canister sets them locally before
    // escalating, and the user_index re-asserts them with the deletion - which `flag_message`
    // reports as NoChange. That must not stop the deletion below.
    match channel
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
    let bot_notifications = if args.delete {
        let results = channel.chat.delete_messages(
            Caller::OCBot(OPENCHAT_BOT_USER_ID),
            args.thread_root_message_index,
            vec![args.message_id],
            true,
            now,
        )?;
        results
            .into_iter()
            .filter_map(|(_, result)| result.ok())
            .flat_map(|r| r.bot_notifications)
            .collect()
    } else {
        Vec::new()
    };
    state.push_bot_notifications(bot_notifications);

    handle_activity_notification(state);
    Ok(())
}
