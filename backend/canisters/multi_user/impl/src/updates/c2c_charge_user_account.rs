use crate::crypto::user_funds_not_spendable;
use crate::guards::caller_is_user_index;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_charge_user_account::*;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_charge_user_account(_args: Args) -> Response {
    Response::Error(user_funds_not_spendable())
}
