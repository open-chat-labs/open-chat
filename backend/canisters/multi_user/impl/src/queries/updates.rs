use canister_api_macros::query;
use user_canister::updates::*;

#[query(msgpack = true)]
fn updates(_args: Args) -> Response {
    unimplemented!()
}
