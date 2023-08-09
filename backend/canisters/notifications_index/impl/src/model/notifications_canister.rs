use serde::{Deserialize, Serialize};
use types::{BuildVersion, TimestampMillis};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct NotificationsCanister {
    added: TimestampMillis,
    wasm_version: BuildVersion,
}

impl NotificationsCanister {
    pub fn new(wasm_version: BuildVersion, now: TimestampMillis) -> NotificationsCanister {
        NotificationsCanister {
            added: now,
            wasm_version,
        }
    }

    pub fn wasm_version(&self) -> BuildVersion {
        self.wasm_version
    }

    pub fn set_wasm_version(&mut self, version: BuildVersion) {
        self.wasm_version = version;
    }
}
