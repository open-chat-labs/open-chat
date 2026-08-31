use crate::read_state;
use constants::{MEMO_P2P_SWAP_ACCEPT, NANOS_PER_MILLISECOND};
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account as LedgerAccount;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use oc_error_codes::OCErrorCode;
use types::icrc2::TransferFromError;
use types::{
    C2CError, CanisterId, CompletedCryptoTransaction, FailedCryptoTransaction, OCResult, PendingCryptoTransaction,
    TimestampMillis, TokenInfo, UserId, icrc1,
};

pub async fn process_transaction(
    transaction: PendingCryptoTransaction,
) -> Result<Result<CompletedCryptoTransaction, FailedCryptoTransaction>, C2CError> {
    process_transaction_internal(transaction, true).await
}

// `process_transaction` should be used whenever possible.
// Only call `process_transaction_without_caller_check` if an async operation has already been
// processed as part of the currently executing update call, since in that scenario we are within a
// reply callback and therefore are not able to access the original `caller`.
// If calling this method, ensure that the caller has been validated earlier on.
pub async fn process_transaction_without_caller_check(
    transaction: PendingCryptoTransaction,
) -> Result<Result<CompletedCryptoTransaction, FailedCryptoTransaction>, C2CError> {
    process_transaction_internal(transaction, false).await
}

async fn process_transaction_internal(
    transaction: PendingCryptoTransaction,
    check_caller: bool,
) -> Result<Result<CompletedCryptoTransaction, FailedCryptoTransaction>, C2CError> {
    let my_user_id = read_state(|state| {
        if check_caller && state.env.caller() != state.data.owner {
            panic!("Only the owner can transfer cryptocurrency");
        }

        UserId::from(state.env.canister_id())
    });

    ledger_utils::process_transaction(transaction, Some(my_user_id), false).await
}

// Pulling from our own account would need an approval we had granted ourselves, so this is always
// a client bug. Reject it rather than let the ledger fail with an allowance error.
pub(crate) fn validate_from_account(from_account: Option<icrc1::Account>, my_user_id: UserId) -> OCResult {
    if from_account.is_some_and(|a| LedgerAccount::from(a) == my_user_id.into()) {
        Err(OCErrorCode::InvalidRequest.with_message("`from_account` cannot be the user's own account"))
    } else {
        Ok(())
    }
}

// Both of the P2P swap accept paths deposit token1 into the same escrow subaccount, differing only
// in where the funds come from. Returns the ledger block index.
pub(crate) async fn deposit_to_accept_p2p_swap(
    escrow_canister_id: CanisterId,
    my_user_id: UserId,
    swap_id: u32,
    token1: &TokenInfo,
    token1_amount: u128,
    now: TimestampMillis,
    from_account: Option<icrc1::Account>,
) -> OCResult<u64> {
    let to = LedgerAccount {
        owner: escrow_canister_id,
        subaccount: Some(deposit_subaccount(my_user_id.as_principal(), swap_id)),
    };
    let amount = (token1_amount + token1.fee).into();
    let fee = Some(token1.fee.into());
    let created_at_time = Some(now * NANOS_PER_MILLISECOND);
    let memo = Some(MEMO_P2P_SWAP_ACCEPT.to_vec().into());
    // Whichever account we spend from, the owner is this canister, so only the subaccount is ours
    // to choose. For ICRC-2 it picks which approval is spent rather than which account is debited.
    let subaccount = icrc1::Account::for_user(my_user_id).subaccount;

    let block_index = match from_account {
        // The allowance is what authorises this - the ledger only lets us pull from an account
        // which has approved this canister as spender - so there is nothing for us to check here.
        Some(from) => icrc_ledger_canister_c2c_client::icrc2_transfer_from(
            token1.ledger,
            &TransferFromArgs {
                spender_subaccount: subaccount,
                from: from.into(),
                to,
                amount,
                fee,
                memo,
                created_at_time,
            },
        )
        .await?
        .map_err(|error| match error {
            TransferFromError::InsufficientFunds { .. } => OCErrorCode::InsufficientFunds.into(),
            // The likeliest failure when funding from a wallet - the user approved too little, or
            // the approval has already been spent - so it gets its own code to report on.
            TransferFromError::InsufficientAllowance { .. } => OCErrorCode::InsufficientAllowance.into(),
            error => OCErrorCode::TransferFailed.with_json(&error),
        })?,
        None => icrc_ledger_canister_c2c_client::icrc1_transfer(
            token1.ledger,
            &TransferArg {
                from_subaccount: subaccount,
                to,
                fee,
                created_at_time,
                memo,
                amount,
            },
        )
        .await?
        .map_err(|error| match error {
            TransferError::InsufficientFunds { .. } => OCErrorCode::InsufficientFunds.into(),
            error => OCErrorCode::TransferFailed.with_json(&error),
        })?,
    };

    Ok(block_index.0.try_into().unwrap())
}
