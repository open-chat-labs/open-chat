use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, Milliseconds, SuccessOnly};

#[ts_export(user, add_hot_group_exclusions)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub groups: Vec<ChatId>,
    pub duration: Option<Milliseconds>,
}

pub type Response = SuccessOnly;
