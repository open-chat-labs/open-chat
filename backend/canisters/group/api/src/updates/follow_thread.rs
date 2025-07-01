use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageIndex, UnitResult};

#[ts_export(group, follow_thread)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: MessageIndex,
    pub new_achievement: bool,
}

pub type Response = UnitResult;
