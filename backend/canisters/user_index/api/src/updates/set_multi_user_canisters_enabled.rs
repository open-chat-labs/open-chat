use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::SuccessOnly;

#[ts_export(user_index, set_multi_user_canisters_enabled)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub enabled: bool,
}

pub type Response = SuccessOnly;
