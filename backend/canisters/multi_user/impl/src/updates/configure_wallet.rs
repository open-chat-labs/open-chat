use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::configure_wallet::*;

#[update(msgpack = true)]
#[trace]
fn configure_wallet(_args: Args) -> Response {
    unimplemented!()
}
