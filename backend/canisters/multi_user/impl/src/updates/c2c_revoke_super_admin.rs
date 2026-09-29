use crate::execute_update;
use crate::guards::caller_is_user_index;
use crate::updates::c2c_grant_super_admin::set_platform_moderator;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_revoke_super_admin::*;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_revoke_super_admin(args: Args) -> Response {
    execute_update(|state| set_platform_moderator(args.user_id, false, state))
}
