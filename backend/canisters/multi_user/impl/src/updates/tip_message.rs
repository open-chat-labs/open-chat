use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::tip_message::*;

#[update(msgpack = true)]
#[trace]
async fn tip_message(_args: Args) -> Response {
    unimplemented!()
}
