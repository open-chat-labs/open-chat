use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_pay_for_premium_item::*;

#[update(msgpack = true)]
#[trace]
fn c2c_pay_for_premium_item(_args: Args) -> Response {
    unimplemented!()
}
