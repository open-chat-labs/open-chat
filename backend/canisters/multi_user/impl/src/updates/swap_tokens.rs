use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::swap_tokens::*;

#[update(msgpack = true)]
#[trace]
async fn swap_tokens(_args: Args) -> Response {
    unimplemented!()
}
