use crate::{RuntimeState, read_state};
use candid::Principal;
use constants::NANOS_PER_MILLISECOND;
use ledger_utils::certified::{MAX_TRANSFER_AGE, verify_certified_transfer};
use oc_error_codes::OCErrorCode;
use types::{OCResult, PendingCryptoTransaction, UserId, icrc1};

pub use ledger_utils::validate_from_account;

// A user in a MultiUser canister holds their own funds, in their principal's default account, and
// makes each transfer themselves by calling the ledger. So the only transfers accepted are certified
// ones, which prove the ledger made the transfer, and each can only be used once.
//
// Verifies the transfer was made by `sender`, the principal of the user it is for, then records it
// as used. The sender is passed in rather than taken from the caller, since the caller isn't
// available once the endpoint has awaited a call.
pub fn use_transfer(
    transaction: PendingCryptoTransaction,
    sender: Principal,
    state: &mut RuntimeState,
) -> OCResult<icrc1::CompletedCryptoTransaction> {
    let PendingCryptoTransaction::Certified(transaction) = transaction else {
        return Err(
            OCErrorCode::InvalidRequest.with_message("Only certified transfers are supported by the MultiUser canister")
        );
    };

    let now = state.env.now();
    let completed = verify_certified_transfer(
        transaction,
        sender,
        state.env.canister_id().as_slice(),
        &state.env.ic_root_key(),
        now,
    )?;

    // Once this has passed the transfer is too old to be accepted, so needn't be remembered. The
    // extra millisecond covers `created` being rounded down.
    let expires = completed.created / NANOS_PER_MILLISECOND + MAX_TRANSFER_AGE + 1;
    if !state
        .data
        .used_transfers
        .try_use(completed.ledger, completed.block_index, expires, now)
    {
        return Err(OCErrorCode::InvalidRequest.with_message("Transfer has already been used"));
    }
    Ok(completed)
}

// Frees a transfer to be used again, when what it was used for definitely failed
pub fn release_transfer(transfer: &icrc1::CompletedCryptoTransaction, state: &mut RuntimeState) {
    state.data.used_transfers.release(transfer.ledger, transfer.block_index);
}

// Checks the transfer is to the given account
pub fn verify_recipient(transaction: &PendingCryptoTransaction, expected: icrc1::Account) -> OCResult {
    let PendingCryptoTransaction::Certified(transaction) = transaction else {
        return Err(
            OCErrorCode::InvalidRequest.with_message("Only certified transfers are supported by the MultiUser canister")
        );
    };

    if icrc_ledger_types::icrc1::account::Account::from(transaction.to) == expected.into() {
        Ok(())
    } else {
        Err(OCErrorCode::InvalidRequest.with_message("Transaction is not to the user's account"))
    }
}

// The account which is the user's wallet. A user in a MultiUser canister holds their own funds, in
// their principal's default account, so that is looked up if they are in another MultiUser canister.
// Any other user's wallet is their account of the canister which holds them.
pub async fn wallet_account(user_id: UserId) -> OCResult<icrc1::Account> {
    let (local_user_principal, is_this_canister, local_user_index_canister_id) = read_state(|state| {
        (
            state
                .user_index(user_id)
                .and_then(|index| state.data.users.with_user(index, |user| user.principal)),
            state.user_index(user_id).is_some(),
            state.data.local_user_index_canister_id,
        )
    });

    if let Some(principal) = local_user_principal {
        Ok(principal.into())
    } else if is_this_canister {
        Err(OCErrorCode::TargetUserNotFound.into())
    } else if !user_id.is_indexed() {
        Ok(icrc1::Account::for_user(user_id))
    } else {
        match local_user_index_canister_c2c_client::lookup_user(user_id.as_principal(), local_user_index_canister_id).await? {
            // The lookup also resolves the principal a user signs in with, which isn't their user id
            Some(user) if user.user_id == user_id => Ok(user.principal.into()),
            _ => Err(OCErrorCode::TargetUserNotFound.into()),
        }
    }
}
