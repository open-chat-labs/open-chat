use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{OptionUpdate, UnitResult, UserId};

#[ts_export(group, update_webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: UserId,
    pub name: Option<String>,
    #[ts(as = "types::OptionUpdateString")]
    pub avatar: OptionUpdate<String>,
}

pub type Response = UnitResult;
