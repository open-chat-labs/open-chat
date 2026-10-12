use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, SuccessOnly};

#[ts_export(user, mute_notifications)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

pub type Response = SuccessOnly;
