use ic_stable_structures::log::WriteError;
use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{DefaultMemoryImpl, StableLog, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use types::{BuildVersion, TimestampMillis};

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

pub struct InstructionCountsLog {
    log: StableLog<InstructionCountEntry, Memory, Memory>,
}

impl InstructionCountsLog {
    pub fn init(index_memory: Memory, data_memory: Memory) -> InstructionCountsLog {
        InstructionCountsLog {
            log: init_log(index_memory, data_memory),
        }
    }

    pub fn record(
        &self,
        function_id: InstructionCountFunctionId,
        instruction_count: u64,
        wasm_version: BuildVersion,
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
    wasm_version: BuildVersion,
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

fn init_log(index_memory: Memory, data_memory: Memory) -> StableLog<InstructionCountEntry, Memory, Memory> {
    StableLog::init(index_memory, data_memory)
}

impl Storable for InstructionCountEntry {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(self.to_vec())
    }

    fn into_bytes(self) -> Vec<u8> {
        self.to_vec()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        msgpack::deserialize_then_unwrap(bytes.as_ref())
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl InstructionCountEntry {
    fn to_vec(&self) -> Vec<u8> {
        msgpack::serialize_then_unwrap(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let entry = InstructionCountEntry {
            timestamp: 10,
            wasm_version: BuildVersion::new(20, 30, 40),
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
