use crate::updates::c2c_tip_message::tip_message_with_completed_transfer;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MEMO_TIP;
use group_canister::tip_message::*;
use ledger_utils::UserTransfer;
use oc_error_codes::OCErrorCode;
use types::{Achievement, Caller, CryptoTransaction, OCResult, UserId, icrc2};
use utils::migrated_user_ids::MigratedUserIds;

#[update(msgpack = true)]
#[trace]
async fn tip_message(args: Args) -> Response {
    execute_update_async(|| tip_message_impl(args)).await.into()
}

async fn tip_message_impl(args: Args) -> OCResult {
    let new_achievement = args.new_achievement;

    let user_id = match mutate_state(|state| prepare(args, state))? {
        // The transfer was certified, so the message has been tipped already
        PrepareResult::Tipped(user_id) => user_id,
        PrepareResult::Icrc2(tip) => {
            let TipToMake {
                user_id,
                spender_subaccount,
                c2c_args,
                transfer,
            } = *tip;

            match ledger_utils::icrc2::process_transaction_for_user(transfer, spender_subaccount).await {
                Ok(Ok(_)) => {}
                Ok(Err((_, error))) => return Err(error),
                Err(error) => return Err(error.into()),
            }

            mutate_state(|state| tip_message_with_completed_transfer(user_id, c2c_args, state))?;
            user_id
        }
    };

    if new_achievement {
        mutate_state(|state| state.notify_user_of_achievement(user_id, Achievement::TippedMessage, state.env.now()));
    }
    Ok(())
}

enum PrepareResult {
    Tipped(UserId),
    Icrc2(Box<TipToMake>),
}

struct TipToMake {
    user_id: UserId,
    // The caller's spender subaccount, under which they approved the transfer
    spender_subaccount: [u8; 32],
    c2c_args: group_canister::c2c_tip_message::Args,
    transfer: icrc2::PendingCryptoTransaction,
}

fn prepare(args: Args, state: &mut RuntimeState) -> OCResult<PrepareResult> {
    let Caller::User(user) = state.verified_caller(None)? else {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };
    let user_id = user.user_id;

    let recipient = state.data.chat.check_can_tip_message(
        user_id,
        args.thread_root_message_index,
        args.message_id,
        &MigratedUserIds::default(),
    )?;

    let c2c_args = group_canister::c2c_tip_message::Args {
        recipient,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.transfer.ledger_canister_id(),
        token_symbol: args.transfer.token_symbol().to_string(),
        amount: args.transfer.units(),
        decimals: args.decimals,
        username: args.username,
        display_name: args.display_name,
    };

    let this_canister_id = state.env.canister_id();
    let recipient_wallet = state.member_wallet(recipient)?;

    match UserTransfer::new(
        CryptoTransaction::Pending(args.transfer),
        recipient_wallet,
        &MEMO_TIP,
        this_canister_id,
    )? {
        UserTransfer::Icrc2(transfer) => Ok(PrepareResult::Icrc2(Box::new(TipToMake {
            user_id,
            spender_subaccount: ledger_utils::spender_subaccount(user.principal),
            c2c_args,
            transfer,
        }))),
        UserTransfer::Certified(transfer) => {
            let now = state.env.now();
            let completed = state.data.certified_transfers.verify(
                transfer,
                state.env.caller(),
                &MEMO_TIP,
                this_canister_id,
                &state.env.ic_root_key(),
                now,
            )?;
            tip_message_with_completed_transfer(user_id, c2c_args, state)?;
            state.data.certified_transfers.mark_used(&completed, now);
            Ok(PrepareResult::Tipped(user_id))
        }
    }
}
