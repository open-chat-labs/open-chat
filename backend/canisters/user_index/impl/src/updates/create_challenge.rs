use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_index_canister::create_challenge::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn create_challenge(_args: Args) -> Response {
    NotRequired
}
