use serde::{Deserialize, Serialize};
use types::Achievement;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub achievements: Vec<Achievement>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotFound,
}
