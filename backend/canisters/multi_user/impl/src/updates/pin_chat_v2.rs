use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::pin_chat_v2::*;

#[update(msgpack = true)]
#[trace]
fn pin_chat_v2(_args: Args) -> Response {
    unimplemented!()
}
