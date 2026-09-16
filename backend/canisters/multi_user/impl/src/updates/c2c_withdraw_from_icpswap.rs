use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_withdraw_from_icpswap::*;

#[update(msgpack = true)]
#[trace]
async fn c2c_withdraw_from_icpswap(_args: Args) -> Response {
    unimplemented!()
}
