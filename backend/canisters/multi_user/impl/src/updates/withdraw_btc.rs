use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::withdraw_btc::*;

#[update(msgpack = true)]
#[trace]
async fn withdraw_btc(_args: Args) -> Response {
    unimplemented!()
}
