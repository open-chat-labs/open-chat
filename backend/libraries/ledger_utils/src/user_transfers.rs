//! Transfers a user makes from their own funds which a canister submits for them, without holding
//! those funds itself, such as a Group or Community a user sends crypto in, or the MultiUser
//! canister holding the user. So a transfer must be one of:
//! - ICRC2: pulled by the canister from an account which approved it as spender under the user's
//!   own spender subaccount (see `spender_subaccount`).
//! - Certified: already made by the user, calling `icrc1_transfer` on the ledger themselves with
//!   the memo `certified::required_memo(memo_prefix, canister_id)`, and proven by the ledger's
//!   certified reply to that call (see `certified::CertifiedTransfers`).

use oc_error_codes::OCErrorCode;
use types::{CanisterId, CryptoTransaction, OCResult, PendingCryptoTransaction, UserId, certified, icrc1, icrc2};

pub enum UserTransfer {
    Icrc2(icrc2::PendingCryptoTransaction),
    Certified(certified::PendingCryptoTransaction),
}

// Who a user's transfer must be to
#[derive(Clone, Copy)]
pub enum TransferRecipient {
    // A user, with the wallet the canister knows them to hold their funds in. A transfer addressed
    // to the account of their user id is sent to their wallet instead (see
    // `PendingCryptoTransaction::send_to_wallet`).
    User { user_id: UserId, wallet: icrc1::Account },
    // Exactly this account, such as a group's own, which holds the prize a message offers
    Account(icrc1::Account),
}

impl UserTransfer {
    // Checks the transfer is one the canister can accept, and is to `recipient`. `memo` is
    // given to an ICRC2 transfer, and is the prefix of the memo a certified transfer must carry.
    pub fn new(
        transfer: CryptoTransaction,
        recipient: TransferRecipient,
        memo: &[u8],
        this_canister_id: CanisterId,
    ) -> OCResult<UserTransfer> {
        let CryptoTransaction::Pending(mut pending) = transfer else {
            return Err(OCErrorCode::InvalidRequest.with_message("Transaction must be of type 'Pending'"));
        };
        if pending.is_zero() {
            return Err(OCErrorCode::TransferCannotBeZero.into());
        }
        let is_to_recipient = match recipient {
            TransferRecipient::User { user_id, wallet } => pending.send_to_wallet(user_id, wallet),
            TransferRecipient::Account(account) => pending.is_to(account.into()),
        };
        if !is_to_recipient {
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

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    const MEMO: &[u8] = b"OC_MSG";

    fn this_canister() -> CanisterId {
        Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 9, 1, 1])
    }

    fn user_in_a_multi_user_canister() -> UserId {
        UserId::new_indexed(Principal::from_slice(&[0, 0, 0, 0, 2, 0, 0, 5, 1, 1]), 7)
    }

    fn wallet() -> icrc1::Account {
        Principal::from_slice(&[9; 29]).into()
    }

    fn recipient() -> TransferRecipient {
        TransferRecipient::User {
            user_id: user_in_a_multi_user_canister(),
            wallet: wallet(),
        }
    }

    fn icrc2_transfer_to(to: icrc1::Account) -> CryptoTransaction {
        CryptoTransaction::Pending(PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
            ledger: Principal::from_slice(&[1; 10]),
            token_symbol: "CHAT".to_string(),
            amount: 1,
            from: Principal::from_slice(&[8; 29]).into(),
            to,
            fee: 0,
            memo: None,
            created: 0,
        }))
    }

    fn certified_transfer_to(to: icrc1::Account) -> CryptoTransaction {
        CryptoTransaction::Pending(PendingCryptoTransaction::Certified(certified::PendingCryptoTransaction {
            ledger: Principal::from_slice(&[1; 10]),
            token_symbol: "CHAT".to_string(),
            amount: 1,
            to,
            fee: 0,
            memo: None,
            created: 0,
            call: certified::CertifiedCall {
                arg: Vec::new(),
                ingress_expiry: 0,
                nonce: None,
                certificate: Vec::new(),
            },
        }))
    }

    fn is_refused(result: OCResult<UserTransfer>) -> bool {
        matches!(result, Err(error) if error.matches_code(OCErrorCode::RecipientMismatch))
    }

    #[test]
    fn transfer_addressed_to_a_users_id_is_pulled_into_their_wallet() {
        let addressed_to_user_id = icrc1::Account::legacy_for_user(user_in_a_multi_user_canister());

        for to in [addressed_to_user_id, wallet()] {
            let Ok(UserTransfer::Icrc2(transfer)) =
                UserTransfer::new(icrc2_transfer_to(to), recipient(), MEMO, this_canister())
            else {
                panic!("Transfer not accepted");
            };
            assert!(PendingCryptoTransaction::ICRC2(transfer).is_to(wallet().into()));
        }
    }

    #[test]
    fn transfer_addressed_to_anyone_else_is_refused() {
        let someone_else = Principal::from_slice(&[7; 29]).into();

        assert!(is_refused(UserTransfer::new(
            icrc2_transfer_to(someone_else),
            recipient(),
            MEMO,
            this_canister()
        )));
    }

    #[test]
    fn certified_transfer_must_have_been_made_to_the_wallet() {
        let addressed_to_user_id = icrc1::Account::legacy_for_user(user_in_a_multi_user_canister());

        assert!(is_refused(UserTransfer::new(
            certified_transfer_to(addressed_to_user_id),
            recipient(),
            MEMO,
            this_canister()
        )));
        assert!(matches!(
            UserTransfer::new(certified_transfer_to(wallet()), recipient(), MEMO, this_canister()),
            Ok(UserTransfer::Certified(_))
        ));
    }

    #[test]
    fn transfer_to_an_account_must_be_addressed_to_exactly_it() {
        let account: icrc1::Account = Principal::from_slice(&[6; 29]).into();
        let recipient = TransferRecipient::Account(account);

        assert!(is_refused(UserTransfer::new(
            icrc2_transfer_to(wallet()),
            recipient,
            MEMO,
            this_canister()
        )));
        assert!(UserTransfer::new(icrc2_transfer_to(account), recipient, MEMO, this_canister()).is_ok());
    }
}
