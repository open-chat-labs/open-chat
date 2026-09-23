use crate::crypto::user_funds_not_spendable;
use crate::guards::caller_is_hosted_user;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::pay_for_streak_insurance::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn pay_for_streak_insurance(_args: Args) -> Response {
    Response::Error(user_funds_not_spendable())
}
