use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityId, UnitResult};

#[ts_export(user, delete_community)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
}

pub type Response = UnitResult;
