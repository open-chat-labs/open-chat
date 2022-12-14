use serde::{Deserialize, Serialize};
use types::{ChatId, Version};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<GroupIndexEvent>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupIndexEvent {
    MaxConcurrentCanisterUpgradesChanged(MaxConcurrentCanisterUpgradesChanged),
    // Use this as a one-off to initialize the first local_group_index from the group_index
    LocalGroupAdded(LocalGroupAdded),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MaxConcurrentCanisterUpgradesChanged {
    pub value: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalGroupAdded {
    pub chat_id: ChatId,
    pub wasm_version: Version,
}
