use crate::User;
use types::OCResult;
use user_canister::save_crypto_account::Args;

pub fn save_crypto_account(user: &mut User, args: Args) -> OCResult {
    user.verify_not_suspended()?;
    user.saved_crypto_accounts.save(args)
}
