use serde::{Deserialize, Serialize};
use types::{Empty, UserId};

pub type Args = Empty;

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub name: String,
    pub members: Vec<UserId>,
}
