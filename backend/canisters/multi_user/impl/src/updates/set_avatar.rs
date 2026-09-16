use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::set_avatar::*;

#[update(msgpack = true)]
#[trace]
fn set_avatar(_args: Args) -> Response {
    unimplemented!()
}
