use canister_tracing_macros::trace;
use ic_cdk::update;
use user_canister::c2c_handle_bot_messages::*;

#[update]
#[trace]
async fn c2c_handle_bot_messages(_args: Args) -> Response {
    unimplemented!()
}
