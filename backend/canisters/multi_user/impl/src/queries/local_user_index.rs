use canister_api_macros::query;
use user_canister::local_user_index::*;

#[query(msgpack = true)]
fn local_user_index(_args: Args) -> Response {
    unimplemented!()
}
