use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::set_message_reminder_v2::*;

#[update(msgpack = true)]
#[trace]
fn set_message_reminder_v2(_args: Args) -> Response {
    unimplemented!()
}
