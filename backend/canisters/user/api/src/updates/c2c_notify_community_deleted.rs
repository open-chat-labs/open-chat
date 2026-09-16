use serde::{Deserialize, Serialize};
use types::{DeletedCommunityInfo, SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub deleted_community: DeletedCommunityInfo,
}

pub type Response = SuccessOnly;
