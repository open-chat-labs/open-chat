use canister_api_macros::query;
use user_canister::token_swap_status::*;

#[query(msgpack = true)]
fn token_swap_status(_args: Args) -> Response {
    unimplemented!()
}
