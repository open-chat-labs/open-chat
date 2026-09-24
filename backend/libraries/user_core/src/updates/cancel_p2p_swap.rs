use crate::User;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis, UserId};
use user_canister::cancel_p2p_swap::Args;

// Cancels the swap the user offered in a direct chat, returning its id for the caller to cancel in
// the escrow canister too
pub fn cancel_p2p_swap(user: &mut User, my_user_id: UserId, args: Args, now: TimestampMillis) -> OCResult<u32> {
    let chat = user
        .direct_chats
        .get_mut(&args.user_id.into())
        .ok_or(OCErrorCode::ChatNotFound)?;
    chat.cancel_p2p_swap(my_user_id, None, args.message_id, now)
        .map(|result| result.value)
}
