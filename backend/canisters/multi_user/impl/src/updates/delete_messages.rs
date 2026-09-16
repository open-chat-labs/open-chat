use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::delete_messages::*;

#[update(msgpack = true)]
#[trace]
fn delete_messages(_args: Args) -> Response {
    unimplemented!()
}
