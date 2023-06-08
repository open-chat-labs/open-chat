use crate::memory::{get_instruction_counts_data_memory, get_instruction_counts_index_memory, Memory};
use ic_stable_structures::log::WriteError;
use ic_stable_structures::{StableLog, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use types::{TimestampMillis, Version};

const INSTRUCTION_COUNT_ENTRY_SIZE_BYTES: usize = 29;

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
        let mut bytes = [0u8; INSTRUCTION_COUNT_ENTRY_SIZE_BYTES];
        bytes[..8].copy_from_slice(&self.timestamp.to_be_bytes());
        bytes[8..12].copy_from_slice(&self.wasm_version.major.to_be_bytes());
        bytes[12..16].copy_from_slice(&self.wasm_version.minor.to_be_bytes());
        bytes[16..20].copy_from_slice(&self.wasm_version.patch.to_be_bytes());
        bytes[20] = self.function_id as u8;
        bytes[21..].copy_from_slice(&self.instruction_count.to_be_bytes());
        Cow::Owned(bytes.to_vec())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        assert_eq!(bytes.len(), INSTRUCTION_COUNT_ENTRY_SIZE_BYTES);

        let timestamp = u64::from_be_bytes(bytes[..8].try_into().unwrap());
        let major = u32::from_be_bytes(bytes[8..12].try_into().unwrap());
        let minor = u32::from_be_bytes(bytes[12..16].try_into().unwrap());
        let patch = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
        let function_id = bytes[20].into();
        let instruction_count = u64::from_be_bytes(bytes[21..].try_into().unwrap());

        InstructionCountEntry {
            timestamp,
            wasm_version: Version { major, minor, patch },
            function_id,
            instruction_count,
        }
    }
}

impl Default for InstructionCountsLog {
    fn default() -> Self {
        Self { log: init_log() }
    }
}

impl From<u8> for InstructionCountFunctionId {
    fn from(value: u8) -> Self {
        match value {
            1 => InstructionCountFunctionId::PreUpgrade,
            2 => InstructionCountFunctionId::PostUpgrade,
            _ => InstructionCountFunctionId::Unknown,
        }
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
