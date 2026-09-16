use canister_api_macros::query;
use user_canister::initial_state::*;

#[query(msgpack = true)]
fn initial_state(_args: Args) -> Response {
    unimplemented!()
}
