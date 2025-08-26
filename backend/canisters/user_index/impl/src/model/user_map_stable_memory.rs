use candid::Deserialize;
use serde::Serialize;
use stable_memory_map::UserIdKeyPrefix;

#[derive(Serialize, Deserialize)]
pub struct UserMapStableMemory {
    prefix: UserIdKeyPrefix,
    count: u32,
}
