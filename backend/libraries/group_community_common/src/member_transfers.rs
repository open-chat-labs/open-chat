//! Transfers a member of a Group or Community makes from their own funds for use within it, to send
//! crypto in a message, fund a prize, tip a message or create a P2P swap. The canister never pays
//! from its own account on a member's behalf, so a transfer must be one of:
//! - ICRC2: pulled by the canister from an account which approved it as spender under the member's
//!   own spender subaccount (see `ledger_utils::spender_subaccount`).
//! - Certified: already made by the member, calling `icrc1_transfer` on the ledger themselves with
//!   the memo `ledger_utils::certified::required_memo(memo_prefix, canister_id)`, and proven by the
//!   ledger's certified reply to that call.

use candid::Principal;
use constants::{MEMO_P2P_SWAP_CREATE, NANOS_PER_MILLISECOND, PRIZE_FEE_PERCENT};
use escrow_canister::deposit_subaccount;
use ledger_utils::certified::{MAX_TRANSFER_AGE, required_memo, verify_certified_transfer};
use oc_error_codes::{OCError, OCErrorCode};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tracing::error;
use types::{
    CanisterId, CompletedCryptoTransaction, CryptoTransaction, MessageIndex, OCResult, P2PSwapContentInitial, P2PSwapLocation,
    PendingCryptoTransaction, PrizeContentInitial, TimestampMillis, TimestampNanos, UserId, UserIdAndPrincipal, certified,
    icrc1, icrc2,
};

pub enum MemberTransfer {
    Icrc2(icrc2::PendingCryptoTransaction),
    Certified(certified::PendingCryptoTransaction),
}

impl MemberTransfer {
    // Checks the transfer is one the canister can accept, and is to `recipient`'s wallet. `memo` is
    // given to an ICRC2 transfer, and is the prefix of the memo a certified transfer must carry.
    pub fn new(
        transfer: CryptoTransaction,
        recipient: UserIdAndPrincipal,
        memo: &[u8],
        this_canister_id: CanisterId,
    ) -> OCResult<MemberTransfer> {
        let CryptoTransaction::Pending(pending) = transfer else {
            return Err(OCErrorCode::InvalidRequest.with_message("Transaction must be of type 'Pending'"));
        };
        if pending.is_zero() {
            return Err(OCErrorCode::TransferCannotBeZero.into());
        }
        if !pending.validate_recipient(recipient) {
            return Err(OCErrorCode::RecipientMismatch.into());
        }

        match pending.set_memo(memo) {
            PendingCryptoTransaction::ICRC2(t) => {
                ledger_utils::validate_from_account(Some(t.from), this_canister_id)?;
                Ok(MemberTransfer::Icrc2(t))
            }
            PendingCryptoTransaction::Certified(t) => Ok(MemberTransfer::Certified(t)),
            PendingCryptoTransaction::NNS(_) | PendingCryptoTransaction::ICRC1(_) => {
                Err(OCErrorCode::InvalidRequest.with_message("Transfer must be ICRC2 or Certified"))
            }
        }
    }
}

// The certified transfers which have been used, so that none is used twice. Each is held until it
// is too old to pass verification anyway, which is only a few minutes.
#[derive(Serialize, Deserialize, Default)]
pub struct CertifiedTransfers {
    // (Ledger, block index) -> when the transfer can be forgotten
    used: BTreeMap<(CanisterId, u64), TimestampNanos>,
}

impl CertifiedTransfers {
    // Verifies a certified transfer `caller` made for use in this canister, and that it hasn't been
    // used already. It is only recorded as used by `mark_used`, which must be called in the same
    // message execution once the transfer has been used.
    pub fn verify(
        &self,
        transaction: certified::PendingCryptoTransaction,
        caller: Principal,
        memo_prefix: &[u8],
        this_canister_id: CanisterId,
        ic_root_key: &[u8],
        now: TimestampMillis,
    ) -> OCResult<icrc1::CompletedCryptoTransaction> {
        let memo = required_memo(memo_prefix, this_canister_id);
        let completed = verify_certified_transfer(transaction, caller, &memo, ic_root_key, now)?;

        if self.used.contains_key(&(completed.ledger, completed.block_index)) {
            Err(OCErrorCode::InvalidRequest.with_message("Transfer has already been used"))
        } else {
            Ok(completed)
        }
    }

    pub fn mark_used(&mut self, transaction: &icrc1::CompletedCryptoTransaction, now: TimestampMillis) {
        let now_nanos = now * NANOS_PER_MILLISECOND;
        self.used.retain(|_, expiry| *expiry >= now_nanos);
        self.used.insert(
            (transaction.ledger, transaction.block_index),
            transaction.created + MAX_TRANSFER_AGE * NANOS_PER_MILLISECOND,
        );
    }
}

// Checks the prize's transfer covers its prizes, the fee for paying out each one, and OpenChat's fee
pub fn validate_prize(prize: &PrizeContentInitial, thread_root_message_index: Option<MessageIndex>) -> OCResult {
    if thread_root_message_index.is_some() {
        return Err(OCErrorCode::InvalidRequest.with_message("Prize messages cannot be sent within threads"));
    }

    let total_prizes = prize.prizes_v2.iter().sum::<u128>();
    let total_transfer_fees = prize.prizes_v2.len() as u128 * prize.transfer.fee();
    let oc_fee = (total_prizes * PRIZE_FEE_PERCENT as u128) / 100;
    let total_amount_to_send = total_prizes + total_transfer_fees + oc_fee;
    let transaction_amount = prize.transfer.units();

    if transaction_amount != total_amount_to_send {
        error!(
            ?total_amount_to_send,
            ?transaction_amount,
            "Expected vs Actual prize transfer"
        );
        return Err(OCErrorCode::InvalidRequest.with_message("Transaction amount must equal total prizes + total fees"));
    }
    Ok(())
}

// A P2P swap a member is creating, which is funded from their own funds via ICRC2
pub struct NewP2PSwap {
    user_id: UserId,
    // The owner of the member's wallet, which the swap pays out and refunds to
    offered_by: Principal,
    from: icrc1::Account,
    args: escrow_canister::create_swap::Args,
}

impl NewP2PSwap {
    // `wallet` is the member's, and funds the swap unless the content names another account
    pub fn new(
        content: &P2PSwapContentInitial,
        location: P2PSwapLocation,
        wallet: UserIdAndPrincipal,
        this_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> OCResult<NewP2PSwap> {
        let from = content.from_account.unwrap_or_else(|| wallet.into());
        ledger_utils::validate_from_account(Some(from), this_canister_id)?;
        let offered_by = icrc1::Account::from(wallet).owner;

        Ok(NewP2PSwap {
            user_id: wallet.user_id,
            offered_by,
            from,
            args: escrow_canister::create_swap::Args {
                location,
                token0: content.token0.clone(),
                token0_amount: content.token0_amount,
                token0_principal: Some(offered_by),
                token1: content.token1.clone(),
                token1_amount: content.token1_amount,
                token1_principal: None,
                expires_at: now + content.expires_in,
                additional_admins: Vec::new(),
                canister_to_notify: Some(this_canister_id),
                user_to_notify: None,
                is_public: false,
            },
        })
    }

    pub fn offered_by(&self) -> Principal {
        self.offered_by
    }

    // Checks the member is a Diamond member, which creating a swap requires, then creates the swap
    // in the Escrow canister and funds it. If funding the swap fails once it exists, its id is
    // returned alongside the error, so that the swap can be cancelled.
    pub async fn create(
        self,
        escrow_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> Result<(u32, CompletedCryptoTransaction), (OCError, Option<u32>)> {
        match local_user_index_canister_c2c_client::lookup_user(self.user_id.as_principal(), local_user_index_canister_id).await
        {
            Ok(Some(user))
                if user.user_id == self.user_id
                    && user.diamond_membership_expires_at.is_some_and(|expires_at| expires_at > now) => {}
            Ok(_) => return Err((OCErrorCode::NotDiamondMember.into(), None)),
            Err(error) => return Err((error.into(), None)),
        }

        use escrow_canister::create_swap::Response;
        let swap_id = match escrow_canister_c2c_client::create_swap(escrow_canister_id, &self.args).await {
            Ok(Response::Success(result)) => result.id,
            Ok(Response::InvalidSwap(message)) => return Err((OCErrorCode::InvalidRequest.with_message(message), None)),
            Ok(Response::Error(error)) => return Err((error, None)),
            Err(error) => return Err((error.into(), None)),
        };

        let token0 = self.args.token0;
        let transfer = icrc2::PendingCryptoTransaction {
            ledger: token0.ledger,
            token_symbol: token0.symbol,
            amount: self.args.token0_amount + token0.fee,
            from: self.from,
            to: icrc1::Account {
                owner: escrow_canister_id,
                subaccount: Some(deposit_subaccount(self.offered_by, swap_id)),
            },
            fee: token0.fee,
            memo: Some(MEMO_P2P_SWAP_CREATE.to_vec().into()),
            created: now * NANOS_PER_MILLISECOND,
        };

        match ledger_utils::icrc2::process_transaction_for_user(transfer, self.user_id).await {
            Ok(Ok(completed)) => Ok((swap_id, completed.into())),
            Ok(Err((_, error))) => Err((error, Some(swap_id))),
            Err(error) => Err((error.into(), Some(swap_id))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: TimestampMillis = 1_800_000_000_000;

    fn completed(block_index: u64, created: TimestampMillis) -> icrc1::CompletedCryptoTransaction {
        let account = icrc1::Account {
            owner: Principal::from_slice(&[1; 29]),
            subaccount: None,
        };
        icrc1::CompletedCryptoTransaction {
            ledger: CanisterId::from_slice(&[0, 0, 0, 0, 2, 0, 0, 5, 1, 1]),
            token_symbol: "TEST".to_string(),
            amount: 1,
            from: account.into(),
            to: account.into(),
            fee: 0,
            memo: None,
            created: created * NANOS_PER_MILLISECOND,
            block_index,
        }
    }

    #[test]
    fn transfers_are_held_until_too_old_to_verify() {
        let mut transfers = CertifiedTransfers::default();
        transfers.mark_used(&completed(1, NOW), NOW);
        transfers.mark_used(&completed(2, NOW + 1), NOW + 1);

        // At exactly `MAX_TRANSFER_AGE` the first transfer can still pass verification, so is kept
        transfers.mark_used(&completed(3, NOW + MAX_TRANSFER_AGE), NOW + MAX_TRANSFER_AGE);
        assert!(transfers.used.contains_key(&(completed(1, NOW).ledger, 1)));

        transfers.mark_used(&completed(4, NOW + MAX_TRANSFER_AGE + 1), NOW + MAX_TRANSFER_AGE + 1);
        let held: Vec<_> = transfers.used.keys().map(|(_, block_index)| *block_index).collect();
        assert_eq!(held, vec![2, 3, 4]);
    }
}
