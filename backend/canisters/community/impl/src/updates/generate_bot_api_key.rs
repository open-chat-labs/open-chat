use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::generate_bot_api_key::{Response::*, *};
use types::{AccessTokenScope, BotApiKeyToken, Chat, CommunityId};
use utils::base64;

#[update(msgpack = true)]
#[trace]
fn generate_bot_api_key(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| generate_bot_api_key_impl(args, state))
}

fn generate_bot_api_key_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    if state.data.bots.get(&args.bot_id).is_none() {
        return BotNotFound;
    };

    let caller = state.env.caller();
    let now = state.env.now();
    let community_id: CommunityId = state.env.canister_id().into();

    let api_key_token = if let Some(channel_id) = args.channel_id {
        let Some(channel) = state.data.channels.get_mut(&channel_id) else {
            return ChannelNotFound;
        };

        let Some(user_id) = state.data.members.lookup_user_id(caller) else {
            return NotAuthorized;
        };

        let Some(member) = channel.chat.members.get(&user_id) else {
            return NotAuthorized;
        };

        if !member.role().is_owner() || member.suspended().value {
            return NotAuthorized;
        }

        let api_key_secret =
            channel
                .bot_api_keys
                .generate(args.bot_id, args.requested_permissions.clone(), now, state.env.rng());

        BotApiKeyToken {
            gateway: state.data.local_user_index_canister_id,
            bot_id: args.bot_id,
            scope: AccessTokenScope::Chat(Chat::Channel(community_id, channel.id)),
            secret: api_key_secret,
            permissions: args.requested_permissions,
        }
    } else {
        let Some(member) = state.data.members.get(caller) else {
            return NotAuthorized;
        };

        if !member.role().is_owner() || member.suspended().value {
            return NotAuthorized;
        }

        let api_key_secret =
            state
                .data
                .bot_api_keys
                .generate(args.bot_id, args.requested_permissions.clone(), now, state.env.rng());

        BotApiKeyToken {
            gateway: state.data.local_user_index_canister_id,
            bot_id: args.bot_id,
            scope: AccessTokenScope::Community(community_id),
            secret: api_key_secret,
            permissions: args.requested_permissions,
        }
    };

    let api_key = base64::from_value(&api_key_token);

    handle_activity_notification(state);

    Success(SuccessResult { api_key })
}
