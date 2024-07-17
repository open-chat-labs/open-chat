use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        for user in state.data.users.iter() {
            state
                .data
                .identity_canister_user_sync_queue
                .push_back((user.principal, Some(user.user_id)));
        }
        crate::jobs::sync_users_to_identity_canister::start_job_if_required(state);

        for canister_id in state.data.deleted_users.iter().map(|u| CanisterId::from(u.user_id)) {
            let local_user_index = local_user_index_canister(canister_id, state.data.test_mode);
            let event = local_user_index_canister::Event::AddCanisterToPool(canister_id);
            state.data.user_index_event_sync_queue.push(local_user_index, event);
        }
        crate::jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
    })
}

fn local_user_index_canister(canister_id: CanisterId, test_mode: bool) -> CanisterId {
    let bytes = canister_id.as_slice();
    if bytes > [0, 0, 0, 0, 2, 32, 0, 0, 1, 1].as_slice() && bytes < [0, 0, 0, 0, 2, 48, 0, 0, 1, 1].as_slice() {
        return if test_mode {
            CanisterId::from_text("pecvb-tqaaa-aaaaf-bhdiq-cai").unwrap()
        } else {
            CanisterId::from_text("nq4qv-wqaaa-aaaaf-bhdgq-cai").unwrap()
        };
    }
    if bytes > [0, 0, 0, 0, 0, 160, 0, 0, 1, 1].as_slice() && bytes < [0, 0, 0, 0, 0, 176, 0, 0, 1, 1].as_slice() {
        return CanisterId::from_text("aboy3-giaaa-aaaar-aaaaq-cai").unwrap();
    }

    assert!(test_mode);
    // This will only be reached during tests + local development
    CanisterId::from_text("be2us-64aaa-aaaaa-qaabq-cai").unwrap()
}
