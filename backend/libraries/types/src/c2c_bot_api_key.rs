use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    Frozen,
    NotAuthorized,
    NotFound,
}
