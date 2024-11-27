use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use registry_canister::set_airdrop_config::{Response::*, *};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update(msgpack = true)]
#[trace]
async fn set_airdrop_config(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_operator => (),
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    }

    if mutate_state(|state| {
        let now = state.env.now();
        state.data.airdrop_config.update(
            |config| {
                if args.enabled == Some(false) {
                    *config = None;
                    true
                } else if let Some(existing) = config {
                    if let Some(community_id) = args.community_id {
                        existing.community_id = community_id;
                    }
                    if let Some(channel_id) = args.channel_id {
                        existing.channel_id = channel_id;
                    }
                    if let Some(community_name) = args.community_name {
                        existing.community_name = community_name;
                    }
                    if let Some(channel_name) = args.channel_name {
                        existing.channel_name = channel_name;
                    }
                    true
                } else if let Ok(new_config) = args.try_into() {
                    *config = Some(new_config);
                    true
                } else {
                    false
                }
            },
            now,
        )
    }) {
        Success
    } else {
        IncompleteConfig
    }
}
