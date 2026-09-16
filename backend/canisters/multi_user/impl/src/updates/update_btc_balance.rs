use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::update_btc_balance::*;

#[update(msgpack = true)]
#[trace]
async fn update_btc_balance(_args: Args) -> Response {
    unimplemented!()
}
