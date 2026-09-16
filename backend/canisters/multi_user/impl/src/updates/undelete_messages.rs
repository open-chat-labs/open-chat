use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::undelete_messages::*;

#[update(msgpack = true)]
#[trace]
fn undelete_messages(_args: Args) -> Response {
    unimplemented!()
}
