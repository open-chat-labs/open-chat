use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::set_bio::*;

#[update(msgpack = true)]
#[trace]
fn set_bio(_args: Args) -> Response {
    unimplemented!()
}
