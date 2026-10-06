use crate::model::files::{File, Files, PutChunkArgs};
use candid::Principal;
use ic_stable_structures::DefaultMemoryImpl;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use proptest::collection::vec as pvec;
use proptest::prelude::*;
use proptest::prop_oneof;
use std::collections::{BTreeMap, BTreeSet};
use test_strategy::proptest;
use types::{AccessorId, CanisterId, FileId, TimestampMillis};
use utils::hasher::hash_bytes;

#[derive(Debug, Clone)]
enum Operation {
    Add {
        owner: Principal,
        accessors: Vec<AccessorId>,
        file_id: FileId,
    },
    Remove {
        file_index: usize,
    },
    Forward {
        owner: Principal,
        accessors: Vec<AccessorId>,
        file_index: usize,
        file_id_seed: u128,
    },
    RemoveAccessor {
        accessor: AccessorId,
    },
    ReplaceAccessor {
        old: AccessorId,
        new: AccessorId,
    },
}

fn operation_strategy() -> impl Strategy<Value = Operation> {
    prop_oneof![
        50 => (any::<usize>(), accessors_strategy(), any::<FileId>())
            .prop_map(|(user_index, accessors, file_id)| Operation::Add { owner: principal(user_index), accessors, file_id }),
        20 => any::<usize>()
            .prop_map(|file_index| Operation::Remove { file_index }),
        10 => (any::<usize>(), accessors_strategy(), any::<usize>(), any::<u128>()).prop_map(|(user_index, accessors, file_index, file_id_seed)| Operation::Forward { owner: principal(user_index), accessors, file_index, file_id_seed } ),
        3 => any::<usize>().prop_map(|user_index| Operation::RemoveAccessor { accessor: principal(user_index) }),
        3 => (any::<usize>(), any::<usize>()).prop_map(|(old, new)| Operation::ReplaceAccessor { old: principal(old), new: principal(new) }),
    ]
}

// The owner may or may not be among them
fn accessors_strategy() -> impl Strategy<Value = Vec<AccessorId>> {
    pvec(any::<usize>().prop_map(principal), 0..3)
}

#[proptest(cases = 10)]
fn comprehensive(#[strategy(pvec(operation_strategy(), 100..1_000))] ops: Vec<Operation>) {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init(memory.get(MemoryId::new(2)));

    let mut files = Files::new_with_blobs_memory(memory.get(MemoryId::new(1)));

    let mut file_ids = Vec::new();

    let mut timestamp = 1000;
    for op in ops.into_iter() {
        if let Operation::Add { owner, file_id, .. } = op {
            file_ids.push((owner, file_id));
        }

        execute_operation(&mut files, op, timestamp, &mut file_ids);
        timestamp += 1000;
    }

    files.check_invariants();
}

fn execute_operation(files: &mut Files, op: Operation, timestamp: TimestampMillis, file_ids: &mut [(Principal, FileId)]) {
    match op {
        Operation::Add {
            owner,
            accessors,
            file_id,
        } => {
            let bytes = file_bytes(file_id);
            files.put_chunk(PutChunkArgs {
                owner,
                file_id,
                hash: hash_bytes(&bytes),
                mime_type: "".to_string(),
                accessors,
                chunk_index: 0,
                chunk_size: 1,
                total_size: bytes.len() as u64,
                bytes,
                expiry: None,
                source_hash: None,
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
            accessors,
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
                    accessors.into_iter().collect(),
                    timestamp,
                );
            }
        }
        Operation::RemoveAccessor { accessor } => {
            let files_before: BTreeMap<FileId, File> = files.files.get_all().into_iter().collect();

            // Only files linked to the accessor which it was the last accessor of are removed
            for file_removed in files.remove_accessor(&accessor) {
                let file = &files_before[&file_removed.file_id];
                assert!(file.owner == accessor || file.accessors.contains(&accessor));
                assert!(file.accessors.iter().all(|a| *a == accessor));
            }
            assert!(files.files.get_all().iter().all(|(_, f)| !f.accessors.contains(&accessor)));
        }
        Operation::ReplaceAccessor { old, new } => {
            let files_before: BTreeMap<FileId, File> = files.files.get_all().into_iter().collect();
            let owner_links_before: Vec<(Principal, FileId)> = files
                .accessors_map
                .get_all()
                .into_iter()
                .flat_map(|(accessor, file_ids)| file_ids.into_iter().map(move |file_id| (accessor, file_id)))
                .filter(|(accessor, file_id)| files_before[file_id].owner == *accessor)
                .collect();

            files.queue_accessor_replacements([(old, new)]);
            while files.make_next_accessor_replacement(2).is_some() {}

            // Each file naming the old accessor names the new one in its place, and nothing else changes
            for (file_id, file) in files.files.get_all() {
                let expected: BTreeSet<AccessorId> = files_before[&file_id]
                    .accessors
                    .iter()
                    .map(|a| if *a == old { new } else { *a })
                    .collect();
                assert_eq!(file.accessors, expected);
            }
            // Owners stay linked to their files
            let links_after = files.accessors_map.get_all();
            for (owner, file_id) in owner_links_before {
                assert!(links_after.get(&owner).is_some_and(|file_ids| file_ids.contains(&file_id)));
            }
        }
    };
}

fn file_bytes(file_id: FileId) -> Vec<u8> {
    vec![file_id as u8]
}

// A small pool so that files share owners and accessors, which vary in length with some a
// byte-prefix of others, as the keys linking accessors to files aren't length prefixed
fn principal(index: usize) -> Principal {
    let index = index % 8;
    Principal::from_slice(&vec![(index / 4) as u8 + 1; index % 4 + 1])
}
