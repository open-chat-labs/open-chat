use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data, NnsNeuron};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    mutate_state(|state| {
        if !state.data.test_mode {
            state.data.nns_neuron = Some(NnsNeuron {
                neuron_id: 17682165960669268263,
                subaccount: [
                    106, 24, 201, 114, 207, 210, 101, 85, 190, 208, 248, 112, 144, 208, 19, 164, 28, 86, 155, 119, 164, 16, 3,
                    35, 254, 181, 161, 84, 24, 147, 57, 111,
                ],
            });
        }
    });

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
