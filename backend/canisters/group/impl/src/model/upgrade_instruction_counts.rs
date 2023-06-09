use crate::memory::{get_instruction_counts_data_memory, get_instruction_counts_index_memory};
use ic_stable_structures::log::WriteError;
use ic_stable_structures::{StableLog, Storable};
use serde::{Deserialize, Serialize};
use stable_memory::Memory;
use std::borrow::Cow;
use types::{TimestampMillis, Version};

#[derive(Serialize, Deserialize)]
pub struct InstructionCountsLog {
    #[serde(skip, default = "init_log")]
    log: StableLog<InstructionCountEntry, Memory, Memory>,
}

impl InstructionCountsLog {
    pub fn record(
        &self,
        function_id: InstructionCountFunctionId,
        instruction_count: u64,
        wasm_version: Version,
        now: TimestampMillis,
    ) -> Result<u64, WriteError> {
        self.log.append(&InstructionCountEntry {
            timestamp: now,
            wasm_version,
            function_id,
            instruction_count,
        })
    }

    pub fn iter(&self) -> impl Iterator<Item = InstructionCountEntry> + '_ {
        self.log.iter()
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct InstructionCountEntry {
    timestamp: u64,
    wasm_version: Version,
    function_id: InstructionCountFunctionId,
    instruction_count: u64,
}

#[repr(u8)]
#[derive(Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
pub enum InstructionCountFunctionId {
    Unknown = 0,
    PreUpgrade = 1,
    PostUpgrade = 2,
}

fn init_log() -> StableLog<InstructionCountEntry, Memory, Memory> {
    StableLog::init(get_instruction_counts_index_memory(), get_instruction_counts_data_memory()).unwrap()
}

impl Storable for InstructionCountEntry {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(msgpack::serialize_then_unwrap(self))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        msgpack::deserialize_then_unwrap(bytes.as_ref())
    }
}

impl Default for InstructionCountsLog {
    fn default() -> Self {
        Self { log: init_log() }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let entry = InstructionCountEntry {
            timestamp: 10,
            wasm_version: Version::new(20, 30, 40),
            function_id: InstructionCountFunctionId::PreUpgrade,
            instruction_count: 100,
        };

        let bytes = entry.to_bytes();

        let from_bytes = InstructionCountEntry::from_bytes(bytes);

        assert_eq!(from_bytes.timestamp, entry.timestamp);
        assert_eq!(from_bytes.wasm_version, entry.wasm_version);
        assert_eq!(from_bytes.function_id, entry.function_id);
        assert_eq!(from_bytes.instruction_count, entry.instruction_count);
    }
}
