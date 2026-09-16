use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_charge_user_account::*;

#[update(msgpack = true)]
#[trace]
async fn c2c_charge_user_account(_args: Args) -> Response {
    unimplemented!()
}
