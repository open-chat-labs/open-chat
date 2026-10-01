use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::SuccessOnly;

// The maximum number of users being migrated to MultiUser canisters at once
#[ts_export(user_index, set_user_migration_concurrency)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub value: u32,
}

pub type Response = SuccessOnly;
