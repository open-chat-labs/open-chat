use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::info;
use user_index_canister::set_internal_moderation_channel::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_internal_moderation_channel(args: Args) -> Response {
    mutate_state(|state| set_internal_moderation_channel_impl(args, state))
}

fn set_internal_moderation_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.internal_moderation_channel = args.channel.map(|c| (c.community_id, c.channel_id));
    info!("Internal moderation channel updated");
    Response::Success
}
