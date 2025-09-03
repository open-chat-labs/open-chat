use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, UnitResult};

#[ts_export(user, leave_group)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

pub type Response = UnitResult;
