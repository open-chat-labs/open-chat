use serde::{Deserialize, Serialize};
use types::{TimestampMillis, Version};
use utils::time::now_millis;

#[derive(Serialize, Deserialize, Default)]
pub struct NotificationsCanister {
    #[serde(default = "now_millis")]
    added: TimestampMillis,
    wasm_version: Version,
}

impl NotificationsCanister {
    pub fn new(wasm_version: Version, now: TimestampMillis) -> NotificationsCanister {
        NotificationsCanister {
            added: now,
            wasm_version,
        }
    }

    pub fn wasm_version(&self) -> Version {
        self.wasm_version
    }

    pub fn set_wasm_version(&mut self, version: Version) {
        self.wasm_version = version;
    }
}
