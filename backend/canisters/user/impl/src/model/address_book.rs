use ic_ledger_types::AccountIdentifier;
use ledger_utils::default_ledger_account;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CanisterId, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct AddressBook {
    accounts: HashMap<AccountIdentifier, AccountOwner>,
}

impl AddressBook {
    pub fn new(my_canister_id: CanisterId, user_index_canister_id: CanisterId) -> AddressBook {
        let mut address_book = AddressBook {
            accounts: HashMap::new(),
        };
        address_book.add(default_ledger_account(my_canister_id), AccountOwner::Me);
        address_book.add(default_ledger_account(user_index_canister_id), AccountOwner::UserIndex);
        address_book
    }

    pub fn get(&self, account_identifier: &AccountIdentifier) -> Option<AccountOwner> {
        self.accounts.get(account_identifier).cloned()
    }

    pub fn add(&mut self, account_identifier: AccountIdentifier, owner: AccountOwner) {
        self.accounts.insert(account_identifier, owner);
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum AccountOwner {
    Me,
    UserIndex,
    User(UserId),
    External(Option<String>),
}
