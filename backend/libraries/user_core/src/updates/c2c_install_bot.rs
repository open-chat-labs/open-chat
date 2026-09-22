use crate::User;
use oc_error_codes::OCErrorCode;
use types::c2c_install_bot::Args;
use types::{OCResult, TimestampMillis, UserId, UserType};

// Installs the bot for the user, provided the user themselves asked for it, creating their chat
// with it, under `anonymized_id`, if they have none
pub fn c2c_install_bot(user: &mut User, args: Args, my_user_id: UserId, anonymized_id: u128, now: TimestampMillis) -> OCResult {
    if args.caller != my_user_id {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    user.verify_not_suspended()?;

    if !user.bots.add(
        args.bot_id,
        args.caller,
        args.granted_permissions.clone(),
        args.granted_autonomous_permissions.clone(),
        args.default_subscriptions.clone(),
        now,
    ) {
        return Err(OCErrorCode::AlreadyAdded.into());
    }

    // If there isn't already a direct chat with the bot, create one now
    let chat = user
        .direct_chats
        .get_or_create(my_user_id, args.bot_id, UserType::BotV2, || anonymized_id, now);

    // Subscribe to permitted chat events
    if let (Some(subscriptions), Some(permissions)) = (args.default_subscriptions, args.granted_autonomous_permissions) {
        chat.subscribe_bot_to_events(
            args.bot_id,
            subscriptions.chat,
            &permissions.permitted_chat_event_categories_to_read(),
        );
    }

    Ok(())
}
