use canister_api_macros::query;
use user_canister::message_activity_feed::*;

#[query(msgpack = true)]
fn message_activity_feed(_args: Args) -> Response {
    unimplemented!()
}
