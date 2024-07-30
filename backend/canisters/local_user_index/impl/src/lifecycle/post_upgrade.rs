use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{jobs, mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use user_canister::Event as UserEvent;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        for (user_id, proof) in state.data.global_users.iter_unique_person_proofs() {
            if state.data.local_users.contains(user_id) {
                state.data.user_event_sync_queue.push(
                    CanisterId::from(*user_id),
                    UserEvent::NotifyUniquePersonProof(Box::new(proof.clone())),
                );
            }
        }
        jobs::sync_events_to_user_canisters::start_job_if_required(state);
    });
}
