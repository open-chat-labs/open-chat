//! Ledger operations on behalf of a user held by a User or MultiUser canister, where the accounts
//! the canister spends from are its own subaccounts, one per user

use constants::{MEMO_P2P_SWAP_ACCEPT, NANOS_PER_MILLISECOND};
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account as LedgerAccount;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use oc_error_codes::OCErrorCode;
use types::icrc2::TransferFromError;
use types::{CanisterId, OCResult, TimestampMillis, TokenInfo, UserId, icrc1};

// Rejects a `from_account` held by `this_canister_id`. Pulling from the canister's own accounts
// would need an approval it had granted itself, so this is always a client bug; and in a canister
// holding many users, another user's funds should only ever be reached through that user.
pub fn validate_from_account(from_account: Option<icrc1::Account>, this_canister_id: CanisterId) -> OCResult {
    if from_account.is_some_and(|a| a.owner == this_canister_id) {
        Err(OCErrorCode::InvalidRequest.with_message("`from_account` cannot be an account held by this canister"))
    } else {
        Ok(())
    }
}

// Both of the P2P swap accept paths deposit token1 into the same escrow subaccount, differing only
// in where the funds come from. Returns the ledger block index.
pub async fn deposit_to_accept_p2p_swap(
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
    let subaccount = icrc1::Account::legacy_for_user(my_user_id).subaccount;

    match from_account {
        // The allowance is what authorises this - the ledger only lets us pull from an account
        // which has approved this canister as spender - so there is nothing for us to check here.
        Some(from) => {
            icrc2_transfer_from(
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
            .await
        }
        None => {
            let block_index = icrc_ledger_canister_c2c_client::icrc1_transfer(
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
            })?;
            Ok(block_index.0.try_into().unwrap())
        }
    }
}

// Pulls funds from an account OpenChat does not control, such as an external wallet, spending the
// allowance that account granted to this canister. Returns the ledger block index.
pub async fn icrc2_transfer_from(ledger: CanisterId, args: &TransferFromArgs) -> OCResult<u64> {
    let block_index = icrc_ledger_canister_c2c_client::icrc2_transfer_from(ledger, args)
        .await?
        .map_err(|error| match error {
            TransferFromError::InsufficientFunds { .. } => OCErrorCode::InsufficientFunds.into(),
            // The likeliest failure when paying from a wallet - the user approved too little, or the
            // approval has already been spent - so it gets its own code to report on.
            TransferFromError::InsufficientAllowance { .. } => OCErrorCode::InsufficientAllowance.into(),
            error => OCErrorCode::TransferFailed.with_json(&error),
        })?;

    Ok(block_index.0.try_into().unwrap())
}
