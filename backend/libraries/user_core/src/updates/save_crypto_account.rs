use crate::User;
use multi_user_canister::save_crypto_account::Args;
use types::OCResult;

pub fn save_crypto_account(user: &mut User, args: Args) -> OCResult {
    user.verify_not_suspended()?;
    user.saved_crypto_accounts.save(args)
}
