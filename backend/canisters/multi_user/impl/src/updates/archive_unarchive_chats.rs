use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::archive_unarchive_chats::*;

#[update(msgpack = true)]
#[trace]
fn archive_unarchive_chats(_args: Args) -> Response {
    unimplemented!()
}
