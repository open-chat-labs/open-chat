use canister_api_macros::query;
use user_canister::events::*;

#[query(msgpack = true)]
fn events(_args: Args) -> Response {
    unimplemented!()
}
