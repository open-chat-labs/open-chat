use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{BridgedUserId, CanisterId, Chat, MessageId, MessageIndex, TimestampMillis, UserId, icrc1};

// The funds sent to accounts on other platforms which no one had linked, eg. tips on their relayed
// messages, which the groups and communities paid into each account's subaccount of the UserIndex,
// held for whoever links the account
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

    pub fn len(&self) -> usize {
        self.deposits.len()
    }

    #[cfg(test)]
    pub fn get(&self, id: u64) -> Option<&HeldDeposit> {
        self.deposits.get(&id)
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
}
