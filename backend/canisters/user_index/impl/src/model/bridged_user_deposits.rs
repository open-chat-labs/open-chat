use constants::DAY_IN_MS;
use ledger_utils::format_crypto_amount_with_symbol;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{
    BridgePlatform, BridgedUserId, CanisterId, Chat, MessageId, MessageIndex, Milliseconds, TimestampMillis, UserId, icrc1,
};

// How long funds are held for whoever links their account, before they're settled (see
// `RuntimeState::settle_bridged_user_deposit`)
pub const DEPOSIT_HOLD_DURATION: Milliseconds = 30 * DAY_IN_MS;

// The funds sent to accounts on other platforms which no one had linked, eg. tips on their relayed
// messages. Each deposit is held in its account's subaccount of the UserIndex (see
// `BridgedUserId::subaccount`) until someone links the account, when it's paid to them, or until
// it's settled, `DEPOSIT_HOLD_DURATION` after it was made.
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

// A held deposit paid to whoever linked its account, less the ledger's fees
#[derive(Debug)]
pub struct Payout {
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub decimals: u8,
    pub amount: u128,
}

// What whoever linked an account on the platform is told once funds held for it are paid to them,
// with each token's total, or None if nothing was paid
pub fn payouts_message(platform: BridgePlatform, payouts: &[Payout]) -> Option<String> {
    let mut totals: Vec<&Payout> = Vec::new();
    let mut amounts: Vec<u128> = Vec::new();
    for payout in payouts {
        match totals.iter().position(|p| p.ledger == payout.ledger) {
            Some(i) => amounts[i] += payout.amount,
            None => {
                totals.push(payout);
                amounts.push(payout.amount);
            }
        }
    }
    if totals.is_empty() {
        return None;
    }
    let lines: Vec<String> = totals
        .iter()
        .zip(amounts)
        .map(|(p, amount)| format!("- {}", format_crypto_amount_with_symbol(amount, p.decimals, &p.token_symbol)))
        .collect();
    Some(format!(
        "Tips held for your {platform} account have been sent to your wallet:\n{}",
        lines.join("\n")
    ))
}

impl BridgedUserDeposits {
    // Holds the deposit, returning its id
    pub fn hold(&mut self, deposit: HeldDeposit) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        self.deposits.insert(id, deposit);
        id
    }

    // Takes those of the deposits held for the account which can be paid, with their ids, to pay to
    // whoever has linked it
    pub fn take_for(&mut self, account: &BridgedUserId, can_pay: impl Fn(&HeldDeposit) -> bool) -> Vec<(u64, HeldDeposit)> {
        self.deposits
            .extract_if(.., |_, deposit| deposit.account == *account && can_pay(deposit))
            .collect()
    }

    // Takes the deposit, if it's still held, to settle it
    pub fn take(&mut self, id: u64) -> Option<HeldDeposit> {
        self.deposits.remove(&id)
    }

    pub fn len(&self) -> usize {
        self.deposits.len()
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
    fn whoever_links_an_account_is_given_only_its_deposits() {
        let nelly = BridgedUserId::Telegram(123456789);
        let bob = BridgedUserId::Discord(80351110224678912);
        let mut deposits = BridgedUserDeposits::default();
        let first = deposits.hold(deposit(nelly, 1_000_000));
        deposits.hold(deposit(bob, 2_000_000));
        let second = deposits.hold(deposit(nelly, 3_000_000));

        let taken = deposits.take_for(&nelly, |_| true);

        let taken: Vec<_> = taken.into_iter().map(|(id, d)| (id, d.account, d.amount)).collect();
        assert_eq!(taken, vec![(first, nelly, 1_000_000), (second, nelly, 3_000_000)]);
        assert!(deposits.take_for(&nelly, |_| true).is_empty());
        assert_eq!(deposits.len(), 1);
    }

    // eg. funds in a ledger the UserIndex doesn't know yet, which wait to be settled
    #[test]
    fn a_deposit_which_cant_be_paid_yet_stays_held() {
        let nelly = BridgedUserId::Telegram(123456789);
        let mut deposits = BridgedUserDeposits::default();
        deposits.hold(deposit(nelly, 1_000_000));
        let unknown = deposits.hold(deposit(nelly, 2_000_000));

        let taken = deposits.take_for(&nelly, |d| d.amount < 2_000_000);

        assert_eq!(taken.len(), 1);
        assert_eq!(deposits.take(unknown).map(|d| d.amount), Some(2_000_000));
    }

    fn payout(ledger: u8, token_symbol: &str, decimals: u8, amount: u128) -> Payout {
        Payout {
            ledger: Principal::from_slice(&[ledger; 10]),
            token_symbol: token_symbol.to_string(),
            decimals,
            amount,
        }
    }

    #[test]
    fn whoever_links_an_account_is_told_each_tokens_total() {
        let message = payouts_message(
            BridgePlatform::Discord,
            &[
                payout(1, "CHAT", 8, 5_0000_0000),
                payout(2, "ckBTC", 8, 1_000),
                payout(1, "CHAT", 8, 2_5000_0000),
            ],
        );

        assert_eq!(
            message.as_deref(),
            Some("Tips held for your Discord account have been sent to your wallet:\n- 7.5 CHAT\n- 0.00001 ckBTC")
        );
    }

    #[test]
    fn amounts_are_shown_with_their_tokens_decimals() {
        let message = payouts_message(BridgePlatform::Telegram, &[payout(1, "USDC", 6, 1_500_000)]);

        assert_eq!(
            message.as_deref(),
            Some("Tips held for your Telegram account have been sent to your wallet:\n- 1.5 USDC")
        );
    }

    #[test]
    fn no_one_is_told_of_nothing() {
        assert!(payouts_message(BridgePlatform::Twitch, &[]).is_none());
    }

    #[test]
    fn a_deposit_claimed_already_isnt_refunded() {
        let nelly = BridgedUserId::Telegram(123456789);
        let mut deposits = BridgedUserDeposits::default();
        let claimed = deposits.hold(deposit(nelly, 1_000_000));
        deposits.take_for(&nelly, |_| true);
        let unclaimed = deposits.hold(deposit(nelly, 2_000_000));

        assert!(deposits.take(claimed).is_none());
        assert_eq!(deposits.take(unclaimed).map(|d| d.amount), Some(2_000_000));
        assert!(deposits.take(unclaimed).is_none());
    }
}
