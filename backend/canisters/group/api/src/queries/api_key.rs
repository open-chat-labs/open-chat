use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ApiKey, UserId};

#[ts_export(group, api_key)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
}

#[ts_export(group, api_key)]
#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ApiKey),
    NotAuthorized,
    NotFound,
}
