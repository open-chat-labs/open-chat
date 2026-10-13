use serde::{Deserialize, Serialize};
use types::{DeletedGroupInfoInternal, SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub deleted_group: DeletedGroupInfoInternal,
}

pub type Response = SuccessOnly;
