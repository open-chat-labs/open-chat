use canister_api_macros::query;
use user_canister::hot_group_exclusions::*;

#[query(msgpack = true)]
fn hot_group_exclusions(_args: Args) -> Response {
    unimplemented!()
}
