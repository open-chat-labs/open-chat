use canister_api_macros::query;
use user_canister::token_swaps::*;

#[query(msgpack = true)]
fn token_swaps(_args: Args) -> Response {
    unimplemented!()
}
