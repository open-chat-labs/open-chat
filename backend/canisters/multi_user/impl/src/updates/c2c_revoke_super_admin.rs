use crate::guards::caller_is_user_index;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::c2c_revoke_super_admin::*;

// No longer called, since nothing read the flag it set, but still served until every UserIndex is
// on a version which doesn't call it, after which this is removed
#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_revoke_super_admin(_args: Args) -> Response {
    Response::Success
}
