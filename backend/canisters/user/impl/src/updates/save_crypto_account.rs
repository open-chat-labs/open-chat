use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ic_ledger_types::AccountIdentifier;
use icrc_ledger_types::icrc1::account::Account;
use oc_error_codes::OCErrorCode;
use std::str::FromStr;
use types::OCResult;
use user_canister::save_crypto_account::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn save_crypto_account(args: Args) -> Response {
    execute_update(|state| save_crypto_account_impl(args, state)).into()
}

fn save_crypto_account_impl(mut args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    args.name = args.name.trim().to_string();
    args.name.truncate(25);
    args.account = args.account.trim().to_string();

    if is_valid_account(&args.account) {
        let name_lowercase = args.name.to_lowercase();
        for named_account in state.data.saved_crypto_accounts.iter_mut() {
            if named_account.account == args.account {
                named_account.name = args.name;
                return Ok(());
            }
            if named_account.name.to_lowercase() == name_lowercase {
                return Err(OCErrorCode::NameTaken.into());
            }
        }
        state.data.saved_crypto_accounts.push(args);
        Ok(())
    } else {
        Err(OCErrorCode::InvalidRequest.into())
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
    use types::UserId;

    #[test]
    fn principal_is_valid() {
        assert!(is_valid_account("2vxsx-fae"));
    }

    #[test]
    fn icrc1_account_with_subaccount_is_valid() {
        let canister_id = Principal::from_slice(&[1, 2, 3, 4, 5, 6, 7, 8, 1, 1]);
        let account = Account::from(UserId::new_indexed(canister_id, 7));
        assert!(account.subaccount.is_some());
        assert!(is_valid_account(&account.to_string()));
    }

    #[test]
    fn account_identifier_is_valid() {
        let account_identifier = AccountIdentifier::new(&Principal::anonymous(), &ic_ledger_types::DEFAULT_SUBACCOUNT);
        assert!(is_valid_account(&account_identifier.to_hex()));
    }

    #[test]
    fn garbage_is_invalid() {
        assert!(!is_valid_account("not an account"));
        assert!(!is_valid_account("2vxsx-fae.zz"));
    }
}
