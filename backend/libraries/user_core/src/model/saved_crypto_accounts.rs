use constants::MAX_SAVED_CRYPTO_ACCOUNTS;
use ic_ledger_types::AccountIdentifier;
use icrc_ledger_types::icrc1::account::Account;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use types::OCResult;
use user_canister::NamedAccount;

const MAX_NAME_LENGTH: usize = 25;

// The crypto accounts the user has saved, each under a name which is unique ignoring case.
// Serialized as the plain list of accounts it wraps.
#[derive(Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct SavedCryptoAccounts(Vec<NamedAccount>);

impl SavedCryptoAccounts {
    // Saves the account under the given name, renaming it if it is already saved, provided the
    // name isn't already used for a different account
    pub fn save(&mut self, mut account: NamedAccount) -> OCResult {
        account.name = account.name.trim().to_string();
        account.name.truncate(MAX_NAME_LENGTH);
        account.account = account.account.trim().to_string();

        if !is_valid_account(&account.account) {
            return Err(OCErrorCode::InvalidRequest.into());
        }

        let name_lowercase = account.name.to_lowercase();
        for named_account in self.0.iter_mut() {
            if named_account.account == account.account {
                named_account.name = account.name;
                return Ok(());
            }
            if named_account.name.to_lowercase() == name_lowercase {
                return Err(OCErrorCode::NameTaken.into());
            }
        }
        if self.0.len() >= MAX_SAVED_CRYPTO_ACCOUNTS {
            return Err(OCErrorCode::LimitReached.with_message(MAX_SAVED_CRYPTO_ACCOUNTS));
        }
        self.0.push(account);
        Ok(())
    }

    pub fn delete(&mut self, name: &str) {
        let name_lowercase = name.to_lowercase();
        self.0.retain(|named| named.name.to_lowercase() != name_lowercase);
    }

    pub fn all(&self) -> &[NamedAccount] {
        &self.0
    }
}

// Either an ICRC-1 textual account, which covers a bare principal as well as an account with a
// subaccount such as another user's wallet, or an ICP ledger account identifier.
fn is_valid_account(text: &str) -> bool {
    Account::from_str(text).is_ok() || AccountIdentifier::from_hex(text).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn saved_accounts_are_limited() {
        let mut accounts = SavedCryptoAccounts::default();
        let account = |i: usize| NamedAccount {
            name: format!("account{i}"),
            account: Principal::from_slice(&(i as u32).to_be_bytes()).to_string(),
        };
        for i in 0..MAX_SAVED_CRYPTO_ACCOUNTS {
            accounts.save(account(i)).unwrap();
        }
        let error = accounts.save(account(MAX_SAVED_CRYPTO_ACCOUNTS)).unwrap_err();
        assert!(error.matches_code(OCErrorCode::LimitReached), "{error:?}");
        // Renaming an account which is already saved is still allowed
        accounts
            .save(NamedAccount {
                name: "renamed".to_string(),
                ..account(0)
            })
            .unwrap();
        accounts.delete("renamed");
        accounts.save(account(MAX_SAVED_CRYPTO_ACCOUNTS)).unwrap();
    }

    #[test]
    fn account_validity() {
        let mut subaccount = [0; 32];
        subaccount[31] = 7;
        let icrc1_with_subaccount = Account {
            owner: Principal::from_slice(&[1, 2, 3, 4, 5, 6, 7, 8, 1, 1]),
            subaccount: Some(subaccount),
        }
        .to_string();
        let account_identifier = AccountIdentifier::new(&Principal::anonymous(), &ic_ledger_types::DEFAULT_SUBACCOUNT).to_hex();

        for (text, valid) in [
            ("2vxsx-fae", true),
            (icrc1_with_subaccount.as_str(), true),
            (account_identifier.as_str(), true),
            ("not an account", false),
            ("2vxsx-fae.zz", false),
        ] {
            assert_eq!(is_valid_account(text), valid, "{text}");
        }
    }

    #[test]
    fn accounts_are_saved_renamed_and_deleted() {
        let mut accounts = SavedCryptoAccounts::default();
        let named = |name: &str, account: &str| NamedAccount {
            name: name.to_string(),
            account: account.to_string(),
        };

        assert!(accounts.save(named(" Mine ", "2vxsx-fae")).is_ok());
        assert_eq!(accounts.all(), [named("Mine", "2vxsx-fae")]);

        // The same name, ignoring case, can't be used for a different account
        let other = Principal::from_slice(&[1]).to_string();
        assert!(accounts.save(named("MINE", &other)).is_err());

        // Saving an account again renames it
        assert!(accounts.save(named("Renamed", "2vxsx-fae")).is_ok());
        assert_eq!(accounts.all(), [named("Renamed", "2vxsx-fae")]);

        assert!(accounts.save(named("Invalid", "not an account")).is_err());

        accounts.delete("renamed");
        assert!(accounts.all().is_empty());
    }

    #[test]
    fn serialized_as_a_plain_list() {
        let accounts = vec![NamedAccount {
            name: "a".to_string(),
            account: "2vxsx-fae".to_string(),
        }];
        let bytes = msgpack::serialize_then_unwrap(&accounts);
        let deserialized: SavedCryptoAccounts = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(deserialized.all(), accounts.as_slice());
    }
}
