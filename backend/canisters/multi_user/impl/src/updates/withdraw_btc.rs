use crate::crypto::user_funds_not_spendable;
use crate::guards::caller_is_hosted_user;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::withdraw_btc::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn withdraw_btc(_args: Args) -> Response {
    Response::Error(user_funds_not_spendable())
}
