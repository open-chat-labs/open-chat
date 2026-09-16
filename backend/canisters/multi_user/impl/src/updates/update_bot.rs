use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::update_bot::*;

#[update(msgpack = true)]
#[trace]
fn update_bot(_args: Args) -> Response {
    unimplemented!()
}
