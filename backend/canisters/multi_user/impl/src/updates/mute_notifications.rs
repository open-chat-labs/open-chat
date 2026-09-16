use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mute_notifications;

#[update(msgpack = true)]
#[trace]
fn mute_notifications(_args: mute_notifications::Args) -> mute_notifications::Response {
    unimplemented!()
}

#[update(msgpack = true)]
#[trace]
fn unmute_notifications(_args: mute_notifications::Args) -> mute_notifications::Response {
    unimplemented!()
}
