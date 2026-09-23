//! Transfers a member of a Group or Community makes from their own funds to fund a prize or create
//! a P2P swap within it. See `ledger_utils::UserTransfer` for which transfers the canister accepts.

use candid::Principal;
use constants::{MEMO_P2P_SWAP_CREATE, MEMO_PRIZE_REFUND, NANOS_PER_MILLISECOND, PRIZE_FEE_PERCENT};
use escrow_canister::deposit_subaccount;
use oc_error_codes::{OCError, OCErrorCode};
use tracing::error;
use types::{
    CanisterId, CompletedCryptoTransaction, MessageIndex, OCResult, P2PSwapContentInitial, P2PSwapLocation,
    PendingCryptoTransaction, PrizeContentInitial, TimestampMillis, UserId, icrc1, icrc2,
};

// Checks the prize's transfer covers its prizes, the fee for paying out each one, and OpenChat's fee
pub fn validate_prize(prize: &PrizeContentInitial, thread_root_message_index: Option<MessageIndex>) -> OCResult {
    if thread_root_message_index.is_some() {
        return Err(OCErrorCode::InvalidRequest.with_message("Prize messages cannot be sent within threads"));
    }

    // Checked, since unchecked arithmetic wraps in release builds, which would let a small transfer
    // fund prizes whose total overflows
    let total_amount_to_send = prize
        .prizes_v2
        .iter()
        .try_fold(0u128, |total, prize| total.checked_add(*prize))
        .and_then(|total_prizes| {
            let total_transfer_fees = (prize.prizes_v2.len() as u128).checked_mul(prize.transfer.fee())?;
            let oc_fee = total_prizes.checked_mul(PRIZE_FEE_PERCENT as u128)? / 100;
            total_prizes.checked_add(total_transfer_fees)?.checked_add(oc_fee)
        })
        .ok_or_else(|| OCErrorCode::InvalidRequest.with_message("Prize amounts are too large"))?;
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

// The refund, less the fee for making it, of a prize whose funds were pulled from `from` but whose
// message then couldn't be sent. The funds are held in the chat canister's own account, so without
// this they would be left there.
pub fn prize_refund(
    transfer: &CompletedCryptoTransaction,
    from: icrc1::Account,
    now: TimestampMillis,
) -> Option<PendingCryptoTransaction> {
    let fee = transfer.fee();
    let amount = transfer.units().checked_sub(fee).filter(|amount| *amount > 0)?;

    Some(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
        ledger: transfer.ledger_canister_id(),
        token_symbol: transfer.token_symbol().to_string(),
        amount,
        to: from,
        fee,
        memo: Some(MEMO_PRIZE_REFUND.to_vec().into()),
        created: now * NANOS_PER_MILLISECOND,
    }))
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
        user_id: UserId,
        wallet: icrc1::Account,
        this_canister_id: CanisterId,
        now: TimestampMillis,
    ) -> OCResult<NewP2PSwap> {
        // The Escrow canister pays out and refunds to the offerer's default account, so that must be
        // the member's wallet
        if wallet.subaccount.is_some() {
            return Err(OCErrorCode::InvalidRequest.with_message("The offerer's wallet must be a default account"));
        }
        let from = content.from_account.unwrap_or(wallet);
        ledger_utils::validate_from_account(Some(from), this_canister_id)?;
        let offered_by = wallet.owner;

        Ok(NewP2PSwap {
            user_id,
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

        match ledger_utils::icrc2::process_transaction_for_user(transfer, ledger_utils::spender_subaccount(self.user_id)).await
        {
            Ok(Ok(completed)) => Ok((swap_id, completed.into())),
            Ok(Err((_, error))) => Err((error, Some(swap_id))),
            Err(error) => Err((error.into(), Some(swap_id))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::CryptoTransaction;

    fn prize(prizes: Vec<u128>, amount: u128) -> PrizeContentInitial {
        let account = icrc1::Account {
            owner: Principal::from_slice(&[1; 29]),
            subaccount: None,
        };
        PrizeContentInitial {
            prizes_v2: prizes,
            transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
                ledger: CanisterId::from_slice(&[0, 0, 0, 0, 2, 0, 0, 5, 1, 1]),
                token_symbol: "TEST".to_string(),
                amount,
                from: account,
                to: account,
                fee: 10,
                memo: None,
                created: 0,
            })),
            end_date: 0,
            caption: None,
            diamond_only: false,
            lifetime_diamond_only: false,
            unique_person_only: false,
            streak_only: 0,
            requires_captcha: false,
            min_chit_earned: 0,
        }
    }

    #[test]
    fn prize_funded_with_prizes_and_fees_is_valid() {
        // 2 prizes of 1000, a fee of 10 to pay out each, and OpenChat's 5%
        assert!(validate_prize(&prize(vec![1000, 1000], 2000 + 20 + 100), None).is_ok());
        assert!(validate_prize(&prize(vec![1000, 1000], 2000 + 20), None).is_err());
    }

    #[test]
    fn prizes_whose_total_overflows_are_rejected() {
        // Without checked arithmetic the total wraps to 30, which a transfer of 30 would then match
        assert!(validate_prize(&prize(vec![u128::MAX, 1], 30), None).is_err());
        assert!(validate_prize(&prize(vec![u128::MAX / 2, u128::MAX / 2], 1), None).is_err());
    }
}
