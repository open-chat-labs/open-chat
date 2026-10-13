use crate::ChatInList;

use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user, unpin_chat)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat: ChatInList,
}

pub type Response = UnitResult;
