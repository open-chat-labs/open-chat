use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::unpin_chat_v2::*;

#[update(msgpack = true)]
#[trace]
fn unpin_chat_v2(_args: Args) -> Response {
    unimplemented!()
}
