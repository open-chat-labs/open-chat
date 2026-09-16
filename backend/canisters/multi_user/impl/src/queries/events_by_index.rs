use canister_api_macros::query;
use user_canister::events_by_index::*;

#[query(msgpack = true)]
fn events_by_index(_args: Args) -> Response {
    unimplemented!()
}
