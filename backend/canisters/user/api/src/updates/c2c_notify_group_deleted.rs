use serde::{Deserialize, Serialize};
use types::{DeletedGroupInfoInternal, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub deleted_group: DeletedGroupInfoInternal,
}

pub type Response = SuccessOnly;
