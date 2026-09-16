use canister_api_macros::query;
use user_canister::public_profile::*;

#[query(msgpack = true)]
fn public_profile(_args: Args) -> Response {
    unimplemented!()
}
