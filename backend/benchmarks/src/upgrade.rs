use crate::canister_id_from_u64;
use canbench_rs::{BenchResult, bench, bench_fn};
use ic_stable_structures::DefaultMemoryImpl;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BuildVersion, CanisterId, CanisterWasm, CanisterWasmBytes, TimestampMillis};

#[derive(Serialize, Deserialize)]
struct State {
    wasm: CanisterWasm,
    codes: HashMap<String, Code>,
}

#[derive(Serialize, Deserialize)]
struct Code {
    created: TimestampMillis,
    claimed: Option<(TimestampMillis, CanisterId)>,
    expiry: Option<TimestampMillis>,
}

// Reads a canister's state back from stable memory, as post_upgrade does, where many small values follow
// a large binary (eg. a stored wasm). On Rust 1.99 the rmp-serde fork's reader made each of those small
// values cost as much as the binary before it.
#[bench(raw)]
fn decode_state_with_large_binary() -> BenchResult {
    let mut memory = MemoryManager::init(DefaultMemoryImpl::default()).get(MemoryId::new(0));

    let state = State {
        wasm: CanisterWasm {
            version: BuildVersion::new(2, 0, 1),
            module: CanisterWasmBytes((0..10_000_000u32).map(|i| (i % 251) as u8).collect()),
        },
        codes: (0..1_000u64)
            .map(|i| {
                let code = Code {
                    created: 1_700_000_000_000 + i,
                    claimed: (i % 30 == 0).then(|| (1_700_000_000_000 + i, canister_id_from_u64(i))),
                    expiry: Some(1_800_000_000_000),
                };
                (format!("CODE{i:08}"), code)
            })
            .collect(),
    };
    msgpack::serialize(&state, stable_memory::get_writer(&mut memory)).unwrap();

    bench_fn(|| {
        let state: State = msgpack::deserialize(stable_memory::get_reader(&memory)).unwrap();
        std::hint::black_box(state);
    })
}
