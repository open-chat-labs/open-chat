use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Milliseconds, OptionUpdate, UnitResult, UserId};

#[ts_export(user, update_chat_settings)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    #[ts(as = "types::OptionUpdateU64")]
    pub events_ttl: OptionUpdate<Milliseconds>,
}

pub type Response = UnitResult;
