use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use ledger_utils::Payer;
use user_canister::c2c_charge_user_account::{Args, Response::*, *};

// Charges the user, paying the UserIndex from `payer`. The caller has already checked the user is
// one it holds, and chosen the payer: the user's wallet, since they hold their own funds, or the
// external account they approved.
pub async fn c2c_charge_user_account(args: Args, payer: Payer, user_index_canister_id: types::CanisterId) -> Response {
    // Whatever the caller checked, the user must be one of this canister's, since it is charging
    // them
    let this_canister_id = ic_cdk::api::canister_self();
    assert_eq!(
        args.user_id.canister_id(),
        this_canister_id,
        "{} is not held by this canister",
        args.user_id
    );

    // The account actually paid from, whichever the caller chose, can't be one of this canister's
    if let Err(error) = ledger_utils::validate_from_account(Some(payer.from), this_canister_id) {
        return Error(error);
    }

    let to = Account::from(user_index_canister_id);
    let amount = args.amount.e8s().into();

    // The allowance is what authorises this - the ledger only lets us pull from an account which has
    // approved this canister as spender - so there is nothing for us to check here.
    match icrc_ledger_canister_c2c_client::icrc2_transfer_from(
        args.ledger_canister_id,
        &TransferFromArgs {
            spender_subaccount: payer.spender_subaccount,
            from: payer.from.into(),
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
    }
}
