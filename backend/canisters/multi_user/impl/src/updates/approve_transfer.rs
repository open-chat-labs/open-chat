use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::approve_transfer::*;

#[update(msgpack = true)]
#[trace]
async fn approve_transfer(_args: Args) -> Response {
    unimplemented!()
}
