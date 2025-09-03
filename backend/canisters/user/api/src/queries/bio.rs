use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user, bio)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
}
