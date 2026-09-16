use canister_api_macros::query;
use user_canister::messages_by_message_index::*;

#[query(msgpack = true)]
fn messages_by_message_index(_args: Args) -> Response {
    unimplemented!()
}
