use canister_api_macros::query;
use user_canister::events_window::*;

#[query(msgpack = true)]
fn events_window(_args: Args) -> Response {
    unimplemented!()
}
