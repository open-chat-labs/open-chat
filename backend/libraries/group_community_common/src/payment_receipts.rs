use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use types::{CanisterId, UserId};

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct PaymentReceipts {
    total: HashMap<CanisterId, u128>,
    by_user: HashMap<UserId, HashMap<CanisterId, u128>>,
}

impl PaymentReceipts {
    pub fn add(&mut self, ledger_canister: CanisterId, amount: u128, user_id: UserId) {
        self.total
            .entry(ledger_canister)
            .and_modify(|e| *e += amount)
            .or_insert(amount);
        self.by_user
            .entry(user_id)
            .and_modify(|ue| {
                ue.entry(ledger_canister).and_modify(|e| *e += amount).or_insert(amount);
            })
            .or_insert_with(|| HashMap::from([(ledger_canister, amount)]));
    }

    // Passes each user id through `f`, replacing each with the id returned, and merging the amounts
    // of any users who end up under the same id. Returns whether any were replaced.
    pub fn update_user_ids(&mut self, f: &mut dyn FnMut(UserId) -> UserId) -> bool {
        let replaced: Vec<_> = self
            .by_user
            .keys()
            .filter_map(|user_id| {
                let latest = f(*user_id);
                (latest != *user_id).then_some((*user_id, latest))
            })
            .collect();

        for (user_id, latest) in replaced.iter() {
            if let Some(amounts) = self.by_user.remove(user_id) {
                let latest_amounts = self.by_user.entry(*latest).or_default();
                for (ledger_canister, amount) in amounts {
                    *latest_amounts.entry(ledger_canister).or_default() += amount;
                }
            }
        }
        !replaced.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn amounts_are_merged_when_user_ids_are_replaced() {
        let ledger1 = CanisterId::from_slice(&[1]);
        let ledger2 = CanisterId::from_slice(&[2]);
        let [old, new, other] = [10, 11, 12].map(|i| UserId::from(Principal::from_slice(&[i])));
        let mut receipts = PaymentReceipts::default();
        receipts.add(ledger1, 100, old);
        receipts.add(ledger2, 5, old);
        receipts.add(ledger1, 20, new);
        receipts.add(ledger1, 7, other);

        assert!(receipts.update_user_ids(&mut |user_id| if user_id == old { new } else { user_id }));
        assert!(!receipts.update_user_ids(&mut |user_id| user_id));

        assert_eq!(
            receipts.by_user,
            HashMap::from([
                (new, HashMap::from([(ledger1, 120), (ledger2, 5)])),
                (other, HashMap::from([(ledger1, 7)])),
            ])
        );
        assert_eq!(receipts.total, HashMap::from([(ledger1, 127), (ledger2, 5)]));
    }
}
