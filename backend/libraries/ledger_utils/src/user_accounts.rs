//! Ledger operations on behalf of a user held by a User or MultiUser canister, which the canister
//! makes from its own account

use candid::Principal;
use constants::{MEMO_P2P_SWAP_ACCEPT, NANOS_PER_MILLISECOND};
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account as LedgerAccount;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use oc_error_codes::OCErrorCode;
use types::icrc2::TransferFromError;
use types::{CanisterId, OCResult, TimestampMillis, TokenInfo, icrc1};

// Where a payment a canister makes for one of its users comes from
pub enum Payer {
    // The canister's own account, which is the wallet of a user alone in their canister
    ThisCanister,
    // An account which has approved the canister as spender, from which the payment is pulled via
    // ICRC-2. `spender_subaccount` picks which approval is spent, so a canister holding many users
    // spends only the approval made under the paying user's own (see `spender_subaccount`).
    Approved {
        from: icrc1::Account,
        spender_subaccount: Option<[u8; 32]>,
    },
}

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

// Deposits token1 into the escrow canister to accept a P2P swap, into the subaccount of the swap
// belonging to `depositor`, the owner of the accepting user's wallet, by which the escrow canister
// knows them. Returns the ledger block index.
pub async fn deposit_to_accept_p2p_swap(
    escrow_canister_id: CanisterId,
    depositor: Principal,
    swap_id: u32,
    token1: &TokenInfo,
    token1_amount: u128,
    now: TimestampMillis,
    payer: Payer,
) -> OCResult<u64> {
    let to = LedgerAccount {
        owner: escrow_canister_id,
        subaccount: Some(deposit_subaccount(depositor, swap_id)),
    };
    let amount = (token1_amount + token1.fee).into();
    let fee = Some(token1.fee.into());
    let created_at_time = Some(now * NANOS_PER_MILLISECOND);
    let memo = Some(MEMO_P2P_SWAP_ACCEPT.to_vec().into());

    match payer {
        // The allowance is what authorises this - the ledger only lets us pull from an account
        // which has approved this canister as spender - so there is nothing for us to check here.
        Payer::Approved {
            from,
            spender_subaccount,
        } => {
            icrc2_transfer_from(
                token1.ledger,
                &TransferFromArgs {
                    spender_subaccount,
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
        Payer::ThisCanister => {
            let block_index = icrc_ledger_canister_c2c_client::icrc1_transfer(
                token1.ledger,
                &TransferArg {
                    from_subaccount: None,
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
