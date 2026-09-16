use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::{c2c_bot_send_message, send_message_v2};

#[update(msgpack = true)]
#[trace]
async fn send_message_v2(_args: send_message_v2::Args) -> send_message_v2::Response {
    unimplemented!()
}

#[update(msgpack = true)]
#[trace]
fn c2c_bot_send_message(_args: c2c_bot_send_message::Args) -> c2c_bot_send_message::Response {
    unimplemented!()
}
