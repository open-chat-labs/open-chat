use crate::crypto::validate_from_account;
use crate::guards::caller_is_user_index;
use crate::{execute_update_async, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use oc_error_codes::OCErrorCode;
use types::icrc1;
use user_canister::c2c_charge_user_account::{Response::*, *};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
async fn c2c_charge_user_account(args: Args) -> Response {
    execute_update_async(|| c2c_charge_user_account_impl(args)).await
}

async fn c2c_charge_user_account_impl(args: Args) -> Response {
    let (user_index_canister_id, canister_id) = read_state(|state| (state.data.user_index_canister_id, state.env.canister_id()));

    // Charging a user held elsewhere would debit whichever of our own users shares their index, so
    // refuse rather than take somebody else's funds.
    if args.user_id.canister_id() != canister_id {
        return Error(OCErrorCode::InvalidRequest.with_message(format!("{} is not held by this canister", args.user_id)));
    }

    if let Err(error) = validate_from_account(args.from_account, args.user_id) {
        return Error(error);
    }

    let to = Account::from(user_index_canister_id);
    let amount = args.amount.e8s().into();
    // Whichever account we charge, the owner is this canister, so only the subaccount is ours to
    // choose. For ICRC-2 it picks which approval is spent rather than which account is debited.
    let subaccount = icrc1::Account::for_user(args.user_id).subaccount;

    match args.from_account {
        // The allowance is what authorises this - the ledger only lets us pull from an account
        // which has approved this canister as spender - so there is nothing for us to check here.
        Some(from) => match icrc_ledger_canister_c2c_client::icrc2_transfer_from(
            args.ledger_canister_id,
            &TransferFromArgs {
                spender_subaccount: subaccount,
                from: from.into(),
                to,
                fee: None,
                created_at_time: None,
                memo: None,
                amount,
            },
        )
        .await
        {
            Ok(Ok(block_index)) => Success(block_index.0.try_into().unwrap()),
            Ok(Err(transfer_error)) => TransferFromError(transfer_error),
            Err(error) => InternalError(format!("{error:?}")),
        },
        None => match icrc_ledger_canister_c2c_client::icrc1_transfer(
            args.ledger_canister_id,
            &TransferArg {
                from_subaccount: subaccount,
                to,
                fee: None,
                created_at_time: None,
                memo: None,
                amount,
            },
        )
        .await
        {
            Ok(Ok(block_index)) => Success(block_index.0.try_into().unwrap()),
            Ok(Err(transfer_error)) => TransferErrorV2(transfer_error),
            Err(error) => InternalError(format!("{error:?}")),
        },
    }
}
