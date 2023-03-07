use serde::{Deserialize, Serialize};
use types::{TimestampMillis, Version};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct NotificationsCanister {
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
