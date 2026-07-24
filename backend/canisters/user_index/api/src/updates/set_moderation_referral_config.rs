use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ModerationReferralConfig, UnitResult};

#[ts_export(user_index, set_moderation_referral_config)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub config: Option<ModerationReferralConfig>,
}

pub type Response = UnitResult;
