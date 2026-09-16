use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::manage_favourite_chats::*;

#[update(msgpack = true)]
#[trace]
fn manage_favourite_chats(_args: Args) -> Response {
    unimplemented!()
}
