use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::delete_direct_chat::*;

#[update(msgpack = true)]
#[trace]
fn delete_direct_chat(_args: Args) -> Response {
    unimplemented!()
}
