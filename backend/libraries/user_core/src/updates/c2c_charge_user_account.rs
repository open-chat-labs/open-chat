use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use types::icrc1;
use user_canister::c2c_charge_user_account::{Args, Response::*, *};

// Charges the user's account, or the external account they approved, paying the UserIndex. The
// caller has already checked the user is one it holds, since the user's id decides which subaccount
// pays (or for ICRC-2, whose approval is spent).
pub async fn c2c_charge_user_account(args: Args, user_index_canister_id: types::CanisterId) -> Response {
    // The user's id picks the subaccount debited, so it must be one of this canister's, whatever
    // the caller checked
    let this_canister_id = ic_cdk::api::canister_self();
    assert_eq!(
        args.user_id.canister_id(),
        this_canister_id,
        "{} is not held by this canister",
        args.user_id
    );

    if let Err(error) = ledger_utils::validate_from_account(args.from_account, this_canister_id) {
        return Error(error);
    }

    let to = Account::from(user_index_canister_id);
    let amount = args.amount.e8s().into();
    // Whichever account we charge, the owner is this canister, so only the subaccount is ours to
    // choose. For ICRC-2 it picks which approval is spent rather than which account is debited.
    let subaccount = icrc1::Account::holding_canister_account(args.user_id).subaccount;

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
