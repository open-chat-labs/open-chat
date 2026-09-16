use canister_api_macros::query;
use user_canister::search_messages::*;

#[query(msgpack = true)]
fn search_messages(_args: Args) -> Response {
    unimplemented!()
}
