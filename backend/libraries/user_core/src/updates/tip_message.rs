use crate::User;
use chat_events::TipMessageArgs;
use constants::{MEMO_TIP, NANOS_PER_MILLISECOND};
use oc_error_codes::OCErrorCode;
use types::{
    Chat, ChatId, CommunityId, OCResult, PendingCryptoTransaction, TimestampMillis, TimestampNanos, UserId, icrc1, icrc2,
};
use user_canister::tip_message::Args;

// Where the tip is applied once it has been paid: the tipper's own copy of a direct chat, or the
// group or community canister holding the message
pub enum Prepared {
    Direct(TipMessageArgs),
    Group(ChatId, group_canister::c2c_tip_message::Args),
    Channel(CommunityId, community_canister::c2c_tip_message::Args),
}

// Checks the tip and which chat it is for, returning where to apply it and the time the transfer
// is stamped with
pub fn prepare(
    user: &mut User,
    my_user_id: UserId,
    args: &mut Args,
    now: TimestampMillis,
) -> OCResult<(Prepared, TimestampNanos)> {
    user.verify_not_suspended()?;

    if args.amount == 0 {
        return Err(OCErrorCode::TransferCannotBeZero.into());
    }
    if my_user_id == args.recipient {
        return Err(OCErrorCode::CannotTipSelf.into());
    }
    ledger_utils::validate_from_account(args.from_account, my_user_id.canister_id())?;

    let now_nanos = now * NANOS_PER_MILLISECOND;
    user.pin_number.verify(args.pin.as_mut(), now)?;

    // A MultiUser canister's users carry an index, and the group or community can't tell them apart
    // by the caller, so it is told which of them is tipping
    let sender = (my_user_id.index() != 0).then_some(my_user_id);

    let prepared = match args.chat {
        Chat::Direct(chat_id) if user.direct_chats.exists(&chat_id) => Prepared::Direct(TipMessageArgs {
            user_id: my_user_id,
            recipient: args.recipient,
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            ledger: args.ledger,
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            now,
        }),
        Chat::Group(group_id) if user.group_chats.exists(&group_id) => Prepared::Group(
            group_id,
            group_canister::c2c_tip_message::Args {
                recipient: args.recipient,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                ledger: args.ledger,
                token_symbol: args.token_symbol.clone(),
                amount: args.amount,
                decimals: args.decimals,
                username: user.username.value.clone(),
                display_name: user.display_name.value.clone(),
                sender,
            },
        ),
        Chat::Channel(community_id, channel_id) if user.communities.exists(&community_id) => Prepared::Channel(
            community_id,
            community_canister::c2c_tip_message::Args {
                recipient: args.recipient,
                channel_id,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                ledger: args.ledger,
                token_symbol: args.token_symbol.clone(),
                amount: args.amount,
                decimals: args.decimals,
                username: user.username.value.clone(),
                display_name: user.display_name.value.clone(),
                sender,
            },
        ),
        _ => return Err(OCErrorCode::ChatNotFound.into()),
    };
    Ok((prepared, now_nanos))
}

// The transfer paying the tip, to the recipient's account: from the account they approved (the
// allowance is what authorises this, so there is nothing to check here) or else the tipper's own
pub fn pending_transfer(args: &Args, now_nanos: TimestampNanos) -> PendingCryptoTransaction {
    match args.from_account {
        Some(from) => PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
            ledger: args.ledger,
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            from,
            to: icrc1::Account::for_user(args.recipient),
            fee: args.fee,
            memo: Some(MEMO_TIP.to_vec().into()),
            created: now_nanos,
        }),
        None => PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
            ledger: args.ledger,
            token_symbol: args.token_symbol.clone(),
            amount: args.amount,
            to: icrc1::Account::for_user(args.recipient),
            fee: args.fee,
            memo: Some(MEMO_TIP.to_vec().into()),
            created: now_nanos,
        }),
    }
}
