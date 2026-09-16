use canister_api_macros::query;
use user_canister::c2c_can_issue_access_token_v2::*;

#[query(msgpack = true)]
fn c2c_can_issue_access_token_v2(_args: Args) -> Response {
    unimplemented!()
}
