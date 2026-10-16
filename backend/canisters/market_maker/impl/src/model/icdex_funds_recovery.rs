use constants::{CHAT_TRANSFER_FEE, ICP_TRANSFER_FEE};
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

// The progress of the one-off job which empties this canister's ICDex account, sends the ICP to the
// SNS treasury and burns the CHAT, ahead of the canister being retired. Each step is recorded here
// as soon as it succeeds, so that a re-run (after a failure, or another upgrade) carries on from
// where the last one got to rather than repeating a step, and so that `/metrics` shows the amounts
// recovered and the ledger block indexes.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct IcdexFundsRecovery {
    pub attempts: u32,
    pub consecutive_failures: u32,
    pub next_attempt_due: Option<TimestampMillis>,
    pub last_error: Option<String>,
    // Why the last attempt stopped short without failing, e.g. ICDex has yet to land a transfer
    pub waiting_for: Option<String>,
    pub open_orders_cancelled: Option<TimestampMillis>,
    pub icdex_balances_before_withdrawal: Option<IcdexBalances>,
    pub withdrawn_from_icdex: Option<IcdexWithdrawal>,
    pub icp_sent_to_sns_treasury: Option<LedgerSweep>,
    pub chat_burned: Option<LedgerSweep>,
    pub completed: Option<TimestampMillis>,
}

// The most this canister has been seen to hold available on ICDex, read just before withdrawing
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct IcdexBalances {
    pub timestamp: TimestampMillis,
    pub chat_e8s: u128,
    pub icp_e8s: u128,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct IcdexWithdrawal {
    pub timestamp: TimestampMillis,
    // The amounts ICDex reported sending to this canister's ledger accounts, net of the ledger fees
    pub chat_e8s: u128,
    pub icp_e8s: u128,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LedgerSweep {
    Transferred {
        timestamp: TimestampMillis,
        amount_e8s: u128,
        block_index: u64,
    },
    // The ledger account held too little to be worth a transfer (or nothing at all)
    NothingToTransfer {
        timestamp: TimestampMillis,
        balance_e8s: u128,
    },
}

#[derive(Debug, PartialEq, Eq)]
pub enum NextStep {
    WithdrawFromIcdex,
    SweepLedgers,
    Done,
}

impl IcdexFundsRecovery {
    pub fn next_step(&self) -> NextStep {
        if self.completed.is_some() {
            NextStep::Done
        } else if self.withdrawn_from_icdex.is_none() {
            NextStep::WithdrawFromIcdex
        } else if self.icp_sent_to_sns_treasury.is_none() || self.chat_burned.is_none() {
            NextStep::SweepLedgers
        } else {
            NextStep::Done
        }
    }

    // Keeps the most seen of each token. ICDex debits its account as soon as `withdraw` is called,
    // so if that call fails after the debit, the balances read on the retry are no longer what is
    // due to land on the ledgers.
    pub fn record_icdex_balances(&mut self, chat_e8s: u128, icp_e8s: u128, now: TimestampMillis) {
        let balances = self.icdex_balances_before_withdrawal.get_or_insert_default();
        balances.timestamp = now;
        balances.chat_e8s = balances.chat_e8s.max(chat_e8s);
        balances.icp_e8s = balances.icp_e8s.max(icp_e8s);
    }

    pub fn record_withdrawal(&mut self, chat_e8s: u128, icp_e8s: u128, now: TimestampMillis) {
        self.withdrawn_from_icdex = Some(IcdexWithdrawal {
            timestamp: now,
            chat_e8s,
            icp_e8s,
        });
    }

    // The amounts of CHAT and ICP due to land on this canister's ledger accounts: the larger of
    // what ICDex reported sending and what it was seen to hold, net of the fee it takes from a
    // withdrawal, in case the `withdraw` call failed after ICDex had debited the account
    pub fn expected_on_ledgers(&self) -> (u128, u128) {
        let (reported_chat, reported_icp) = self.withdrawn_from_icdex.as_ref().map_or((0, 0), |w| (w.chat_e8s, w.icp_e8s));
        let (held_chat, held_icp) = self.icdex_balances_before_withdrawal.as_ref().map_or((0, 0), |b| {
            (
                amount_to_transfer(b.chat_e8s, CHAT_TRANSFER_FEE).unwrap_or_default(),
                amount_to_transfer(b.icp_e8s, ICP_TRANSFER_FEE).unwrap_or_default(),
            )
        });
        (reported_chat.max(held_chat), reported_icp.max(held_icp))
    }
}

// The amount to transfer out of a ledger account which holds `balance`, with the fee paid on top:
// the whole balance less the fee, or nothing if the balance doesn't more than cover the fee
pub fn amount_to_transfer(balance: u128, fee: u128) -> Option<u128> {
    (balance > fee).then(|| balance - fee)
}

// The amount to burn from a ledger account which holds `balance`. A burn pays no fee, so the whole
// balance goes, but the ledger rejects a burn of less than the fee as `BadBurn`
pub fn amount_to_burn(balance: u128, fee: u128) -> Option<u128> {
    (balance >= fee).then_some(balance)
}

// ICDex debits its account balance as soon as `withdraw` is called, but the ledger transfers run
// asynchronously inside it, so the ledger account is only swept once at least the amount ICDex
// reported sending has landed in it
pub fn withdrawal_has_landed(ledger_balance: u128, withdrawn_e8s: u128) -> bool {
    ledger_balance >= withdrawn_e8s
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case(0, 10_000, None)]
    #[test_case(10_000, 10_000, None)]
    #[test_case(10_001, 10_000, Some(1))]
    #[test_case(340_048_522, 10_000, Some(340_038_522))]
    fn amount_to_transfer_leaves_the_fee(balance: u128, fee: u128, expected: Option<u128>) {
        assert_eq!(amount_to_transfer(balance, fee), expected);
    }

    #[test_case(0, 100_000, None)]
    #[test_case(99_999, 100_000, None)]
    #[test_case(100_000, 100_000, Some(100_000))]
    #[test_case(55_964_885_000_000, 100_000, Some(55_964_885_000_000))]
    fn amount_to_burn_is_the_whole_balance(balance: u128, fee: u128, expected: Option<u128>) {
        assert_eq!(amount_to_burn(balance, fee), expected);
    }

    #[test_case(0, 0, true)]
    #[test_case(0, 1, false)]
    #[test_case(7_150_000_000, 7_150_000_000, true)]
    #[test_case(7_150_100_000, 7_150_000_000, true)]
    #[test_case(7_149_999_999, 7_150_000_000, false)]
    fn withdrawal_has_landed_once_the_reported_amount_is_on_the_ledger(balance: u128, withdrawn: u128, expected: bool) {
        assert_eq!(withdrawal_has_landed(balance, withdrawn), expected);
    }

    #[test]
    fn steps_run_in_order_and_a_completed_recovery_does_nothing_more() {
        let mut recovery = IcdexFundsRecovery::default();
        assert_eq!(recovery.next_step(), NextStep::WithdrawFromIcdex);

        recovery.record_withdrawal(100, 10, 1);
        assert_eq!(recovery.next_step(), NextStep::SweepLedgers);

        recovery.icp_sent_to_sns_treasury = Some(LedgerSweep::Transferred {
            timestamp: 2,
            amount_e8s: 10,
            block_index: 1,
        });
        assert_eq!(recovery.next_step(), NextStep::SweepLedgers);

        recovery.chat_burned = Some(LedgerSweep::Transferred {
            timestamp: 3,
            amount_e8s: 100,
            block_index: 2,
        });
        assert_eq!(recovery.next_step(), NextStep::Done);

        recovery.completed = Some(4);
        assert_eq!(recovery.next_step(), NextStep::Done);
    }

    #[test]
    fn expected_on_ledgers_is_what_icdex_reported_sending() {
        let mut recovery = IcdexFundsRecovery::default();
        assert_eq!(recovery.expected_on_ledgers(), (0, 0));

        recovery.record_icdex_balances(55_964_885_000_000, 340_048_522, 1);
        recovery.record_withdrawal(55_964_884_900_000, 340_038_522, 2);
        assert_eq!(recovery.expected_on_ledgers(), (55_964_884_900_000, 340_038_522));
    }

    // The `withdraw` call failed after ICDex had debited the account, so the retry found nothing
    // left there and ICDex reported sending nothing, but the funds are still due to land
    #[test]
    fn expected_on_ledgers_falls_back_to_the_balances_seen_before_withdrawing() {
        let mut recovery = IcdexFundsRecovery::default();
        recovery.record_icdex_balances(7_150_100_000, 48_522, 1);
        recovery.record_icdex_balances(0, 0, 2);
        recovery.record_withdrawal(0, 0, 3);

        let balances = recovery.icdex_balances_before_withdrawal.as_ref().unwrap();
        assert_eq!((balances.chat_e8s, balances.icp_e8s), (7_150_100_000, 48_522));
        assert_eq!(recovery.expected_on_ledgers(), (7_150_000_000, 38_522));
    }

    // Dust which doesn't cover the fee is never sent, so none is expected
    #[test]
    fn expected_on_ledgers_ignores_balances_within_the_fee() {
        let mut recovery = IcdexFundsRecovery::default();
        recovery.record_icdex_balances(100_000, 10_000, 1);
        recovery.record_withdrawal(0, 0, 2);
        assert_eq!(recovery.expected_on_ledgers(), (0, 0));
    }
}
