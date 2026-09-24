use crate::{P2PSwap, User};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use types::{
    CanisterId, Chat, MessageId, OCResult, P2PSwapAccepted, P2PSwapLocation, ReserveP2PSwapSuccess, TimestampMillis, UserId,
};
use user_canister::accept_p2p_swap::Args;

// The swap reserved for the user while their deposit is made
pub struct Reserved {
    pub reserve_success: ReserveP2PSwapSuccess,
    // Translated before the deposit is made, so that a root the user cannot see fails the call
    // rather than leaving the other user uninformed of the acceptance
    pub thread_root_message_id: Option<MessageId>,
}

// Checks the acceptance and reserves the swap for the user, recording `depositor`, the owner of
// their wallet, by which the escrow canister will name them. The caller then deposits token1 into
// the escrow canister.
pub fn prepare(
    user: &mut User,
    my_user_id: UserId,
    depositor: Principal,
    this_canister_id: CanisterId,
    args: &mut Args,
    now: TimestampMillis,
) -> OCResult<Reserved> {
    user.verify_not_suspended()?;
    user.pin_number.verify(args.pin.as_mut(), now)?;
    ledger_utils::validate_from_account(args.from_account, this_canister_id)?;

    let chat = user
        .direct_chats
        .get_mut(&args.user_id.into())
        .ok_or(OCErrorCode::ChatNotFound)?;
    let thread_root_message_id = chat.thread_root_message_id(args.thread_root_message_index)?;
    let reserve_success = chat.reserve_p2p_swap(my_user_id, depositor, args.thread_root_message_index, args.message_id, now)?;

    Ok(Reserved {
        reserve_success,
        thread_root_message_id,
    })
}

// Records the deposit made, returning the acceptance to send the other user if the user's copy of
// the message was marked accepted, in which case the caller also awards `AcceptedP2PSwapOffer`
pub fn deposited(
    user: &mut User,
    my_user_id: UserId,
    args: &Args,
    reserve_success: ReserveP2PSwapSuccess,
    token1_txn_in: u64,
    now: TimestampMillis,
) -> Option<P2PSwapAccepted> {
    let content = reserve_success.content;
    user.p2p_swaps.add(P2PSwap {
        id: content.swap_id,
        location: P2PSwapLocation::from_message(
            Chat::Direct(args.user_id.into()),
            args.thread_root_message_index,
            args.message_id,
        ),
        created_by: reserve_success.created_by,
        created: reserve_success.created,
        token0: content.token0,
        token0_amount: content.token0_amount,
        token1: content.token1,
        token1_amount: content.token1_amount,
        expires_at: content.expires_at,
    });

    let chat = user.direct_chats.get_mut(&args.user_id.into())?;
    chat.accept_p2p_swap(
        my_user_id,
        args.thread_root_message_index,
        args.message_id,
        token1_txn_in,
        now,
    )
    .ok()
    .map(|result| result.value)
}

// Frees the swap again, the deposit having failed
pub fn deposit_failed(user: &mut User, my_user_id: UserId, args: &Args, now: TimestampMillis) {
    if let Some(chat) = user.direct_chats.get_mut(&args.user_id.into()) {
        chat.unreserve_p2p_swap(my_user_id, args.thread_root_message_index, args.message_id, now);
    }
}
