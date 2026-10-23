use constants::DAY_IN_MS;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{BridgedUserId, CanisterId, Chat, MessageId, MessageIndex, Milliseconds, TimestampMillis, UserId, icrc1};

// How long a tip is held for whoever links its account, before it's refunded
pub const TIP_HOLD_DURATION: Milliseconds = 30 * DAY_IN_MS;

// The tips on messages relayed from accounts no one had linked. Each is held in its account's
// subaccount of the UserIndex (see `BridgedUserId::tips_subaccount`) until someone links the
// account, when it's paid to them, or until it's refunded, `TIP_HOLD_DURATION` after it was made.
#[derive(Serialize, Deserialize, Default)]
pub struct BridgedUserDeposits {
    deposits: BTreeMap<u64, HeldDeposit>,
    next_id: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HeldDeposit {
    pub account: BridgedUserId,
    // The message the funds were sent with, eg. as a tip on it
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub sender: UserId,
    // The account the funds came from, where they're refunded to
    pub refund_to: icrc1::Account,
    pub ledger: CanisterId,
    pub token_symbol: String,
    // What arrived in the account's subaccount. The sender paid the fee on top.
    pub amount: u128,
    // The ledger's fee when the funds were sent, which a payout of them is less
    pub fee: u128,
    // The token's, so a payout's amount can be shown
    pub decimals: u8,
    pub timestamp: TimestampMillis,
}

impl BridgedUserDeposits {
    // Holds the deposit, returning its id
    pub fn hold(&mut self, deposit: HeldDeposit) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        self.deposits.insert(id, deposit);
        id
    }

    // Takes the tips held for the account, with their ids, to pay to whoever has linked it
    pub fn take_for(&mut self, account: &BridgedUserId) -> Vec<(u64, HeldTip)> {
        self.tips.extract_if(.., |_, tip| tip.account == *account).collect()
    }

    // Takes the tip, if it's still held, to refund it
    pub fn take(&mut self, id: u64) -> Option<HeldTip> {
        self.tips.remove(&id)
    }

    pub fn len(&self) -> usize {
        self.tips.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn deposit(account: BridgedUserId, amount: u128) -> HeldDeposit {
        HeldDeposit {
            account,
            chat: Chat::Group(Principal::from_slice(&[1; 10]).into()),
            thread_root_message_index: None,
            message_id: 1u64.into(),
            sender: Principal::from_slice(&[2; 10]).into(),
            refund_to: Principal::from_slice(&[3; 29]).into(),
            ledger: Principal::from_slice(&[4; 10]),
            token_symbol: "CHAT".to_string(),
            amount,
            fee: 100_000,
            decimals: 8,
            timestamp: 0,
        }
    }

    // Two equal deposits for the same account are still two deposits
    #[test]
    fn each_deposit_is_held_with_its_own_id() {
        let nelly = BridgedUserId::Telegram(123456789);
        let mut deposits = BridgedUserDeposits::default();

        let first = deposits.hold(deposit(nelly, 1_000_000));
        let second = deposits.hold(deposit(nelly, 1_000_000));

        assert_ne!(first, second);
        assert_eq!(deposits.len(), 2);
    }

    #[test]
    fn whoever_links_an_account_is_given_only_its_tips() {
        let nelly = BridgedUserId::Telegram(123456789);
        let bob = BridgedUserId::Discord(80351110224678912);
        let mut tips = BridgedUserTips::default();
        let first = tips.hold(tip(nelly, 1_000_000));
        tips.hold(tip(bob, 2_000_000));
        let second = tips.hold(tip(nelly, 3_000_000));

        let taken = tips.take_for(&nelly);

        let taken: Vec<_> = taken.into_iter().map(|(id, tip)| (id, tip.account, tip.amount)).collect();
        assert_eq!(taken, vec![(first, nelly, 1_000_000), (second, nelly, 3_000_000)]);
        assert!(tips.take_for(&nelly).is_empty());
        assert_eq!(tips.len(), 1);
    }

    #[test]
    fn a_tip_claimed_already_isnt_refunded() {
        let nelly = BridgedUserId::Telegram(123456789);
        let mut tips = BridgedUserTips::default();
        let claimed = tips.hold(tip(nelly, 1_000_000));
        tips.take_for(&nelly);
        let unclaimed = tips.hold(tip(nelly, 2_000_000));

        assert!(tips.take(claimed).is_none());
        assert_eq!(tips.take(unclaimed).map(|tip| tip.amount), Some(2_000_000));
        assert!(tips.take(unclaimed).is_none());
    }
}
