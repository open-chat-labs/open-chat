use crate::model::files::{Files, PutChunkArgs};
use candid::Principal;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use ic_stable_structures::DefaultMemoryImpl;
use proptest::collection::vec as pvec;
use proptest::prelude::*;
use proptest::prop_oneof;
use test_strategy::proptest;
use types::{AccessorId, CanisterId, FileId, Hash, TimestampMillis};

#[derive(Debug, Clone)]
enum Operation {
    Add {
        owner: Principal,
        file_id: FileId,
    },
    Remove {
        file_index: usize,
    },
    Forward {
        owner: Principal,
        file_index: usize,
        file_id_seed: u128,
    },
    UpdateAccessorId {
        old: Principal,
        new: Principal,
    },
    RemoveAccessor {
        accessor: AccessorId,
    },
}

fn operation_strategy() -> impl Strategy<Value = Operation> {
    prop_oneof![
        50 => (any::<usize>(), any::<FileId>())
            .prop_map(|(user_index, file_id)| Operation::Add { owner: principal(user_index), file_id }),
        20 => any::<usize>()
            .prop_map(|file_index| Operation::Remove { file_index }),
        10 => (any::<usize>(), any::<usize>(), any::<u128>()).prop_map(|(user_index, file_index, file_id_seed)| Operation::Forward { owner: principal(user_index), file_index, file_id_seed } ),
        5 => (any::<usize>(), any::<usize>()).prop_map(|(old_index, new_index)| Operation::UpdateAccessorId { old: principal(old_index), new: principal(new_index) } ),
        3 => any::<usize>().prop_map(|user_index| Operation::RemoveAccessor { accessor: principal(user_index) }),
    ]
}

#[proptest(cases = 10)]
fn comprehensive(#[strategy(pvec(operation_strategy(), 1_000..5_000))] ops: Vec<Operation>) {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init(memory.get(MemoryId::new(1)));

    let mut files = Files::default();

    let mut file_ids = Vec::new();

    let mut timestamp = 1000;
    for op in ops.into_iter() {
        if let Operation::Add { owner, file_id } = op {
            file_ids.push((owner, file_id));
        }

        execute_operation(&mut files, op, timestamp, &mut file_ids);
        timestamp += 1000;
    }

    files.check_invariants();
}

fn execute_operation(files: &mut Files, op: Operation, timestamp: TimestampMillis, file_ids: &mut [(Principal, FileId)]) {
    match op {
        Operation::Add { owner, file_id } => {
            files.put_chunk(PutChunkArgs {
                owner,
                file_id,
                hash: hash(file_id),
                mime_type: "".to_string(),
                accessors: vec![owner],
                chunk_index: 0,
                chunk_size: 1,
                total_size: 1,
                bytes: vec![1],
                expiry: None,
                now: timestamp,
            });
        }
        Operation::Remove { file_index } => {
            if !file_ids.is_empty() {
                let index = file_index % file_ids.len();
                let (_, file_id) = file_ids[index];
                files.remove_file(file_id);
            }
        }
        Operation::Forward {
            owner,
            file_index,
            file_id_seed,
        } => {
            if !file_ids.is_empty() {
                let index = file_index % file_ids.len();
                let (_, file_id) = file_ids[index];
                files.forward(
                    owner,
                    file_id,
                    CanisterId::from_slice(&[1]),
                    file_id_seed,
                    [owner].into_iter().collect(),
                    timestamp,
                );
            }
        }
        Operation::UpdateAccessorId { old, new } => files.update_accessor_id(old, new),
        Operation::RemoveAccessor { accessor } => {
            files.remove_accessor(&accessor);
        }
    };
}

fn hash(file_id: FileId) -> Hash {
    let mut bytes = [0u8; 32];
    bytes[0] = (file_id % 100) as u8;
    bytes
}

fn principal(index: usize) -> Principal {
    Principal::from_slice(&index.to_be_bytes())
}
