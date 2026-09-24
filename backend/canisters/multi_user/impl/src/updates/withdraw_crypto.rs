use crate::crypto::user_funds_not_spendable;
use crate::guards::caller_is_hosted_user;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::withdraw_crypto_v2::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn withdraw_crypto_v2(_args: Args) -> Response {
    Response::Error(user_funds_not_spendable())
}
