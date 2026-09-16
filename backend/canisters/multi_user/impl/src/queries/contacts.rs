use canister_api_macros::query;
use user_canister::contacts::*;

#[query(msgpack = true)]
fn contacts(_args: Args) -> Response {
    unimplemented!()
}
