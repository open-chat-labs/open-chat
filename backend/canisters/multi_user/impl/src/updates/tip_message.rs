use crate::crypto::user_wallet;
use crate::guards::caller_is_hosted_user;
use crate::updates::c2c_user_canister_v2::receive_tip;
use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{NullEventPusher, TipMessageArgs};
use constants::{MEMO_TIP, NANOS_PER_MILLISECOND};
use oc_error_codes::OCErrorCode;
use types::{Achievement, CanisterId, Chat, OCResult, UserId, icrc1, icrc2};
use user_canister::UserCanisterEvent;
use user_canister::tip_message::{Response::*, *};

// The User canister's `tip_message`, for direct chats. Users hold their own funds in their own
// wallets, so the tip is pulled from the user's wallet (or the account they name) via ICRC2, against
// an approval made under their own spender subaccount, and paid into the recipient's wallet. Tips in
// groups and channels are given by calling the group or community directly.
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn tip_message(mut args: Args) -> Response {
    let PrepareOk {
        my_index,
        my_user_id,
        my_principal,
        tip_args,
        their_index,
        local_user_index_canister_id,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    // A user in this canister holds their funds under their own principal
    let recipient_wallet: icrc1::Account = match their_index {
        Some(their_index) => match read_state(|state| state.data.users.with_user(their_index, |user| user.principal)) {
            Some(principal) => principal.into(),
            None => return Error(OCErrorCode::TargetUserNotFound.into()),
        },
        None => match user_wallet(args.recipient, local_user_index_canister_id).await {
            Ok(wallet) => wallet,
            Err(error) => return Error(error),
        },
    };

    // The tip is pulled from the tipper's wallet, or the account they name, which `verify` checked
    // isn't one of this canister's own, into the recipient's wallet
    let transfer = icrc2::PendingCryptoTransaction {
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        from: args.from_account.unwrap_or(my_principal.into()),
        to: recipient_wallet,
        fee: args.fee,
        memo: Some(MEMO_TIP.to_vec().into()),
        created: tip_args.now * NANOS_PER_MILLISECOND,
    };
    match ledger_utils::icrc2::process_transaction_for_user(transfer, ledger_utils::spender_subaccount(my_principal)).await {
        Ok(Ok(_)) => {}
        Ok(Err((_, error))) => return Error(error),
        Err(error) => return Error(error.into()),
    }

    mutate_state(|state| {
        let now = state.env.now();
        state.award_achievement_and_notify(my_index, Achievement::TippedMessage, now);
        tip_direct_chat_message(my_index, my_user_id, their_index, tip_args, args.decimals, state)
    })
}

struct PrepareOk {
    my_index: u16,
    my_user_id: UserId,
    my_principal: Principal,
    tip_args: TipMessageArgs,
    their_index: Option<u16>,
    local_user_index_canister_id: CanisterId,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    if !matches!(args.chat, Chat::Direct(_)) {
        return Err(OCErrorCode::InvalidRequest.with_message("Tip messages in groups and channels via the group or community"));
    }
    let this_canister_id = state.env.canister_id();
    let now = state.env.now();
    let (my_index, my_user_id, my_principal, tip_args) = state.with_caller_user_mut(|my_index, user| {
        let my_user_id = UserId::new_indexed(this_canister_id, my_index);
        user_core::updates::tip_message::verify(user, my_user_id, args, this_canister_id, now)?;
        let tip_args = user_core::updates::tip_message::direct_tip_args(user, my_user_id, args, now)?;
        OCResult::Ok((my_index, my_user_id, user.principal, tip_args))
    })?;
    let their_index = state.index_of_local_user(args.recipient);
    if their_index.is_none() && state.user_index(args.recipient).is_some() {
        // An index in this canister which no longer holds a user
        return Err(OCErrorCode::TargetUserNotFound.into());
    }
    Ok(PrepareOk {
        my_index,
        my_user_id,
        my_principal,
        tip_args,
        their_index,
        local_user_index_canister_id: state.data.local_user_index_canister_id,
    })
}

// Records the tip in the tipper's copy of the chat, then the recipient's: directly if they are in
// this canister, else via their canister as the User canister does
fn tip_direct_chat_message(
    my_index: u16,
    my_user_id: UserId,
    their_index: Option<u16>,
    args: TipMessageArgs,
    decimals: u8,
    state: &mut RuntimeState,
) -> Response {
    let recipient = args.recipient;
    // TODO: Push the tip to the event store (`UserEventPusher` in the User canister)
    let c2c_args = match state.data.users.with_user_mut(my_index, |user| {
        user_core::updates::tip_message::tip_direct_chat_message::<NullEventPusher>(
            user,
            args,
            decimals,
            &state.data.migrated_user_ids,
            None,
        )
    }) {
        Some(Ok(c2c_args)) => c2c_args,
        Some(Err(error)) => return Error(error),
        // The tipper was deleted while the transfer was being made
        None => return Error(OCErrorCode::InitiatorNotFound.into()),
    };

    match their_index {
        Some(their_index) => {
            let now = state.env.now();
            receive_tip(c2c_args, my_user_id, recipient, their_index, now, state);
        }
        None => state.push_user_canister_event(my_index, recipient, UserCanisterEvent::TipMessage(Box::new(c2c_args))),
    }
    Success
}
