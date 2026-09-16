use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::{send_message_with_transfer_to_channel, send_message_with_transfer_to_group};

#[update(msgpack = true)]
#[trace]
async fn send_message_with_transfer_to_channel(
    _args: send_message_with_transfer_to_channel::Args,
) -> send_message_with_transfer_to_channel::Response {
    unimplemented!()
}

#[update(msgpack = true)]
#[trace]
async fn send_message_with_transfer_to_group(
    _args: send_message_with_transfer_to_group::Args,
) -> send_message_with_transfer_to_group::Response {
    unimplemented!()
}
