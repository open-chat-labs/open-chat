use crate::env::ENV;
use crate::utils::{metrics, tick_many};
use crate::{TestEnv, client, wasms};
use constants::ONE_MB;
use sha256::sha256;
use std::collections::HashSet;
use std::ops::Deref;
use types::{BuildVersion, CanisterId, CanisterWasm, Hash};

#[test]
fn chunk_store_holds_only_the_current_wasms_once_upgrades_complete() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);

    // A chunk which isn't part of any current wasm
    let stale_chunk: Hash = env
        .upload_chunk(local_user_index, Some(canister_ids.user_index), vec![1, 2, 3])
        .unwrap()
        .try_into()
        .unwrap();

    let version = BuildVersion::new(0, 0, 1);
    client::user_index::happy_path::upgrade_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version,
            module: wasms::USER.module.clone(),
        },
    );
    // Wait for the User canisters to be upgraded, after which the chunk store is refreshed
    for _ in 0..100 {
        tick_many(env, 5);
        let metrics = metrics(env, local_user_index);
        if metrics["user_upgrades_pending"] == 0 && metrics["user_upgrades_in_progress"] == 0 {
            break;
        }
    }
    tick_many(env, 10);

    let stored: HashSet<Hash> = env
        .stored_chunks(local_user_index, Some(canister_ids.user_index))
        .unwrap()
        .into_iter()
        .map(|h| h.try_into().unwrap())
        .collect();

    assert!(!stored.contains(&stale_chunk));
    for wasm in [&wasms::USER.module, &wasms::GROUP.module, &wasms::COMMUNITY.module] {
        for chunk in chunk_hashes(wasm) {
            assert!(stored.contains(&chunk), "Chunk missing from the chunk store");
        }
    }

    // New users' canisters are installed with the latest wasm
    let user = client::register_user(env, canister_ids);
    assert_eq!(wasm_version(env, user.canister()), version);

    // Releasing a new User wasm would break later tests which draw this env
    wrapper.discard();
}

fn chunk_hashes(wasm: &[u8]) -> Vec<Hash> {
    wasm.chunks(ONE_MB as usize).map(sha256).collect()
}

fn wasm_version(env: &pocket_ic::PocketIc, canister_id: CanisterId) -> BuildVersion {
    serde_json::from_value(metrics(env, canister_id)["wasm_version"].clone()).unwrap()
}
