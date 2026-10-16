use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, set_alchemy_api_key)]
#[derive(Serialize, Deserialize)]
pub struct Args {
    pub api_key: Option<String>,
}

// Written by hand so that `#[trace]` doesn't record the key
impl std::fmt::Debug for Args {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args").field("api_key_set", &self.api_key.is_some()).finish()
    }
}

pub type Response = UnitResult;
