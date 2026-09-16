use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::withdraw_crypto_v2::*;

#[update(msgpack = true)]
#[trace]
async fn withdraw_crypto_v2(_args: Args) -> Response {
    unimplemented!()
}
