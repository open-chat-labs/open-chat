use crate::User;
use chat_events::{EventPusher, TipMessageArgs};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, Chat, EventIndex, OCResult, TimestampMillis, UserId};
use user_canister::tip_message::Args;

// Checks the user may give the tip: they aren't suspended, it isn't nothing or to themselves, any
// account it is given from isn't one of this canister's, and their PIN, if they have one, is right
pub fn verify(
    user: &mut User,
    my_user_id: UserId,
    args: &mut Args,
    this_canister_id: CanisterId,
    now: TimestampMillis,
) -> OCResult {
    user.verify_not_suspended()?;

    if args.amount == 0 {
        return Err(OCErrorCode::TransferCannotBeZero.into());
    }
    if my_user_id == args.recipient {
        return Err(OCErrorCode::CannotTipSelf.into());
    }
    ledger_utils::validate_from_account(args.from_account, this_canister_id)?;
    user.pin_number.verify(args.pin.as_mut(), now)?;
    Ok(())
}

// The tip of a message in the user's direct chat. Checked before any funds move, as a group does:
// the tip must be to the other user in the chat, on a message they sent.
pub fn direct_tip_args(user: &User, my_user_id: UserId, args: &Args, now: TimestampMillis) -> OCResult<TipMessageArgs> {
    let Chat::Direct(chat_id) = args.chat else {
        return Err(OCErrorCode::ChatNotFound.into());
    };
    let chat = user.direct_chats.get(&chat_id).ok_or(OCErrorCode::ChatNotFound)?;
    if chat_id != args.recipient.into() {
        return Err(OCErrorCode::RecipientMismatch.into());
    }
    let (message, _) = chat
        .events()
        .message_internal(EventIndex::default(), args.thread_root_message_index, args.message_id.into())
        .ok_or(OCErrorCode::MessageNotFound)?;
    if message.sender != args.recipient {
        return Err(OCErrorCode::RecipientMismatch.into());
    }
    Ok(TipMessageArgs {
        user_id: my_user_id,
        recipient: args.recipient,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        now,
    })
}

// Records the tip, once paid, in the tipper's copy of the direct chat, returning what the other
// user's copy is sent
pub fn tip_direct_chat_message<P: EventPusher>(
    user: &mut User,
    args: TipMessageArgs,
    decimals: u8,
    event_pusher: Option<P>,
) -> OCResult<user_canister::TipMessageArgs> {
    let chat = user
        .direct_chats
        .get_mut(&args.recipient.into())
        .ok_or(OCErrorCode::ChatNotFound)?;
    chat.tip_message(args.clone(), event_pusher)?;
    let thread_root_message_id = chat.thread_root_message_id(args.thread_root_message_index)?;
    Ok(user_canister::TipMessageArgs {
        thread_root_message_id,
        message_id: args.message_id,
        ledger: args.ledger,
        token_symbol: args.token_symbol,
        amount: args.amount,
        decimals,
        username: user.username.value.clone(),
        display_name: user.display_name.value.clone(),
        user_avatar_id: user.avatar.id(),
    })
}
