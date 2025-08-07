use serde::{Deserialize, Serialize};
use types::{Milliseconds, PublicCommunityActivity, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub duration: Milliseconds,
    pub public_community_activity: Option<PublicCommunityActivity>,
}

pub type Response = SuccessOnly;
