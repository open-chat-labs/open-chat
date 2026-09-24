//! Transfers a user makes from their own funds which a canister submits for them, without holding
//! those funds itself, such as a Group or Community a user sends crypto in, or the MultiUser
//! canister holding the user. So a transfer must be one of:
//! - ICRC2: pulled by the canister from an account which approved it as spender under the user's
//!   own spender subaccount (see `spender_subaccount`).
//! - Certified: already made by the user, calling `icrc1_transfer` on the ledger themselves with
//!   the memo `certified::required_memo(memo_prefix, canister_id)`, and proven by the ledger's
//!   certified reply to that call (see `certified::CertifiedTransfers`).

use oc_error_codes::OCErrorCode;
use types::{CanisterId, CryptoTransaction, OCResult, PendingCryptoTransaction, certified, icrc1, icrc2};

pub enum UserTransfer {
    Icrc2(icrc2::PendingCryptoTransaction),
    Certified(certified::PendingCryptoTransaction),
}

impl UserTransfer {
    // Checks the transfer is one the canister can accept, and is to `recipient`. `memo` is
    // given to an ICRC2 transfer, and is the prefix of the memo a certified transfer must carry.
    pub fn new(
        transfer: CryptoTransaction,
        recipient: icrc1::Account,
        memo: &[u8],
        this_canister_id: CanisterId,
    ) -> OCResult<UserTransfer> {
        let CryptoTransaction::Pending(pending) = transfer else {
            return Err(OCErrorCode::InvalidRequest.with_message("Transaction must be of type 'Pending'"));
        };
        if pending.is_zero() {
            return Err(OCErrorCode::TransferCannotBeZero.into());
        }
        if !pending.is_to(recipient.into()) {
            return Err(OCErrorCode::RecipientMismatch.into());
        }
        if pending.must_be_submitted_by_account_owner() {
            return Err(OCErrorCode::InvalidRequest.with_message("Transfer must be ICRC2 or Certified"));
        }

        match pending.set_memo(memo) {
            PendingCryptoTransaction::ICRC2(t) => {
                crate::validate_from_account(Some(t.from), this_canister_id)?;
                Ok(UserTransfer::Icrc2(t))
            }
            PendingCryptoTransaction::Certified(t) => Ok(UserTransfer::Certified(t)),
            PendingCryptoTransaction::NNS(_) | PendingCryptoTransaction::ICRC1(_) => unreachable!(),
        }
    }
}
