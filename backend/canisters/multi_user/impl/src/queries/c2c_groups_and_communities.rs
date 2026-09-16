use canister_api_macros::query;
use user_canister::c2c_groups_and_communities::*;

#[query(msgpack = true)]
fn c2c_groups_and_communities(_args: Args) -> Response {
    unimplemented!()
}
