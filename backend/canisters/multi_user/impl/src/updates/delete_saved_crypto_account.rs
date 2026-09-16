use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::delete_saved_crypto_account::*;

#[update(msgpack = true)]
#[trace]
fn delete_saved_crypto_account(_args: Args) -> Response {
    unimplemented!()
}
