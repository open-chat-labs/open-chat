use canister_api_macros::query;
use user_canister::bio::*;

#[query(msgpack = true)]
fn bio(_args: Args) -> Response {
    unimplemented!()
}
