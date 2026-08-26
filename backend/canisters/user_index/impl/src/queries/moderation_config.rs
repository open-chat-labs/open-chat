use crate::guards::caller_is_platform_operator;
use crate::read_state;
use canister_api_macros::query;
use user_index_canister::moderation_config::{Response::*, *};

#[query(guard = "caller_is_platform_operator", msgpack = true)]
fn moderation_config(_args: Args) -> Response {
    read_state(|state| {
        Success(SuccessResult {
            openai_api_key_set: state.data.openai_api_key.is_some(),
            internal_moderation_channel: state.data.internal_moderation_channel.map(|(community_id, channel_id)| {
                InternalModerationChannel {
                    community_id,
                    channel_id,
                }
            }),
            moderation_referral_config: state.data.moderation_referral_config.clone(),
            vault_reviewers: state.data.vault_reviewers.iter().copied().collect(),
            media_scan_config: state.data.media_scan_config.clone(),
            authority_reporter: state.data.authority_reporter,
        })
    })
}
