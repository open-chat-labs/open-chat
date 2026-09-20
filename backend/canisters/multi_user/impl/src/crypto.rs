use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use oc_error_codes::OCErrorCode;
use types::icrc2::TransferFromError;
use types::{CanisterId, OCResult, icrc1};

// Rejects a `from_account` held by this canister. The user's own account is always rejected, as the
// User canister does, and so is that of any other user of this canister, whose funds a user should
// only ever reach through that user.
pub(crate) fn validate_from_account(from_account: Option<icrc1::Account>, this_canister_id: CanisterId) -> OCResult {
    if from_account.is_some_and(|a| a.owner == this_canister_id) {
        Err(OCErrorCode::InvalidRequest.with_message("`from_account` cannot be an account held by this canister"))
    } else {
        Ok(())
    }
}

// As the User canister's `icrc2_transfer_from`. Returns the ledger block index.
pub(crate) async fn icrc2_transfer_from(ledger: CanisterId, args: &TransferFromArgs) -> OCResult<u64> {
    let block_index = icrc_ledger_canister_c2c_client::icrc2_transfer_from(ledger, args)
        .await?
        .map_err(|error| match error {
            TransferFromError::InsufficientFunds { .. } => OCErrorCode::InsufficientFunds.into(),
            TransferFromError::InsufficientAllowance { .. } => OCErrorCode::InsufficientAllowance.into(),
            error => OCErrorCode::TransferFailed.with_json(&error),
        })?;

    Ok(block_index.0.try_into().unwrap())
}
