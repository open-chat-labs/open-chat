use ic_ledger_types::AccountIdentifier;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::CanisterId;

#[derive(Serialize, Deserialize, Default)]
pub struct Accounts {
    accounts: HashMap<AccountIdentifier, CanisterId>,
}

impl Accounts {
    pub fn add(&mut self, account_identifier: AccountIdentifier, canister_id: CanisterId) {
        self.accounts.insert(account_identifier, canister_id);
    }

    #[allow(dead_code)]
    pub fn get_canister_id(&self, account_identifier: &AccountIdentifier) -> Option<CanisterId> {
        self.accounts.get(account_identifier).copied()
    }
}
