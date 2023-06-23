use serde::{Deserialize, Serialize};
use types::{Milliseconds, PublicCommunityActivity};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub duration: Milliseconds,
    pub public_community_activity: Option<PublicCommunityActivity>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
