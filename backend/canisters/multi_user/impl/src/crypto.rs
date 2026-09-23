use oc_error_codes::{OCError, OCErrorCode};

// Users hold their own funds in their principal's account, which this canister can't spend from or
// approve transfers from. So the endpoints which would spend a user's funds for them reject the
// request until users can make those payments themselves.
pub fn user_funds_not_spendable() -> OCError {
    OCErrorCode::InvalidRequest
        .with_message("Not supported by the MultiUser canister, since users hold their own funds in their own wallets")
}
