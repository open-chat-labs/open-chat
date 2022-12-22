use serde::{Deserialize, Serialize};
use types::{ChatId, Version};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub groups: Vec<Group>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Group {
    pub chat_id: ChatId,
    pub wasm_version: Version,
}
