use canister_api_macros::query;
use user_canister::deleted_message::*;

#[query(msgpack = true)]
fn deleted_message(_args: Args) -> Response {
    unimplemented!()
}
