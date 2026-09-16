use canister_api_macros::query;
use user_canister::chit_events::*;

#[query(msgpack = true)]
fn chit_events(_args: Args) -> Response {
    unimplemented!()
}
