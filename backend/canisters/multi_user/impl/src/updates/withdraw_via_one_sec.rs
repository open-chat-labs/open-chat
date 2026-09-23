use crate::crypto::user_funds_not_spendable;
use crate::guards::caller_is_hosted_user;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::withdraw_via_one_sec::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn withdraw_via_one_sec(_args: Args) -> Response {
    Response::Error(user_funds_not_spendable())
}
