use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::SuccessOnly;

#[ts_export(notifications_index, mark_subscription_active)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub endpoint: String,
}

pub type Response = SuccessOnly;
