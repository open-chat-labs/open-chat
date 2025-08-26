use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotInstallationLocation, UnitResult, UserId};

#[ts_export(local_user_index, uninstall_bot)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub location: BotInstallationLocation,
    pub bot_id: UserId,
}

pub type Response = UnitResult;
