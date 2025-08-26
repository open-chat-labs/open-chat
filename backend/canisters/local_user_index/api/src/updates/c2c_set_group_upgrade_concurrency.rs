use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub value: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Capped(u32),
}
