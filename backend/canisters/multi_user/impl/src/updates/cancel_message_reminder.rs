use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::cancel_message_reminder::*;

#[update(msgpack = true)]
#[trace]
fn cancel_message_reminder(_args: Args) -> Response {
    unimplemented!()
}
