use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CommunityId, Empty, ModerationReferralConfig, UserId};

pub type Args = Empty;

// The current moderation configuration, so operators can see what is actually set rather than
// staring at write-only forms. The OpenAI key itself is never returned - only whether it is set.
#[ts_export(user_index, moderation_config)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user_index, moderation_config)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub openai_api_key_set: bool,
    pub internal_moderation_channel: Option<InternalModerationChannel>,
    pub moderation_referral_config: Option<ModerationReferralConfig>,
    pub vault_reviewers: Vec<UserId>,
}

#[ts_export(user_index, moderation_config)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct InternalModerationChannel {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}
