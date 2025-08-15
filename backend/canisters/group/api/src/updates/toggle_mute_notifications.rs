use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(group, toggle_mute_notifications)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub mute: Option<bool>,
    pub mute_at_everyone: Option<bool>,
}

pub type Response = UnitResult;
