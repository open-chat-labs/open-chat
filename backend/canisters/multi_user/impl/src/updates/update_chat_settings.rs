use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::update_chat_settings::*;

#[update(msgpack = true)]
#[trace]
async fn update_chat_settings(_args: Args) -> Response {
    unimplemented!()
}
