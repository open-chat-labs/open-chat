use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, Empty};

pub type Args = Empty;

#[ts_export(user, hot_group_exclusions)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<ChatId>),
}
