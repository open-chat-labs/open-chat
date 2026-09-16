use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mark_read::*;

#[update(msgpack = true)]
#[trace]
fn mark_read(_args: Args) -> Response {
    unimplemented!()
}
