use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::report_message::*;

#[update(msgpack = true)]
#[trace]
async fn report_message(_args: Args) -> Response {
    unimplemented!()
}
