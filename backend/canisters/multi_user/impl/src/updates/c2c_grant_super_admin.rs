use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_grant_super_admin::*;

#[update(msgpack = true)]
#[trace]
fn c2c_grant_super_admin(_args: Args) -> Response {
    unimplemented!()
}
