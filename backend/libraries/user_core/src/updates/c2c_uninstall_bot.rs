use crate::User;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use stable_memory_map::BaseKeyPrefix;
use types::c2c_uninstall_bot::Args;
use types::{OCResult, TimestampMillis, UserId};

// Uninstalls the bot, provided the user themselves asked for it or the OpenChat bot did on their
// behalf. The OpenChat bot names no user, so only a User canister, which holds one, can honour it;
// a MultiUser canister rejects that caller before reaching here. Returns the stable memory prefixes
// of the chat with the bot, for the caller to garbage collect.
pub fn c2c_uninstall_bot(
    user: &mut User,
    args: &Args,
    my_user_id: UserId,
    now: TimestampMillis,
) -> OCResult<Vec<BaseKeyPrefix>> {
    if args.caller != OPENCHAT_BOT_USER_ID {
        if args.caller != my_user_id {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
        user.verify_not_suspended()?;
    }

    Ok(user.uninstall_bot(args.bot_id, now))
}
