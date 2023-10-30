use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use proposals_bot_canister::post_upgrade::Args;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let min_dissolve_delays = vec![
        (CanisterId::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap(), 15778800000),
        (CanisterId::from_text("zqfso-syaaa-aaaaq-aaafq-cai").unwrap(), 2629800000),
        (CanisterId::from_text("2jvtu-yqaaa-aaaaq-aaama-cai").unwrap(), 2628000000),
        (CanisterId::from_text("74ncn-fqaaa-aaaaq-aaasa-cai").unwrap(), 2628000000),
        (CanisterId::from_text("6wcax-haaaa-aaaaq-aaava-cai").unwrap(), 7889400000),
        (CanisterId::from_text("4l7o7-uiaaa-aaaaq-aaa2q-cai").unwrap(), 604800000),
        (CanisterId::from_text("xvj4b-paaaa-aaaaq-aabfa-cai").unwrap(), 2629800000),
        (CanisterId::from_text("xomae-vyaaa-aaaaq-aabhq-cai").unwrap(), 2628000000),
        (CanisterId::from_text("umz53-fiaaa-aaaaq-aabmq-cai").unwrap(), 2629000000),
        (CanisterId::from_text("rceqh-cqaaa-aaaaq-aabqa-cai").unwrap(), 2630016000),
        (CanisterId::from_text("rqch6-oaaaa-aaaaq-aabta-cai").unwrap(), 5260032000),
        (CanisterId::from_text("qgj7v-3qaaa-aaaaq-aabwa-cai").unwrap(), 2630016000),
    ];

    let neuron_dissolve_delays = vec![
        (CanisterId::from_text("2jvtu-yqaaa-aaaaq-aaama-cai").unwrap(), 2628000000),
        (CanisterId::from_text("6wcax-haaaa-aaaaq-aaava-cai").unwrap(), 101000),
        (CanisterId::from_text("4l7o7-uiaaa-aaaaq-aaa2q-cai").unwrap(), 100001000),
        (CanisterId::from_text("xvj4b-paaaa-aaaaq-aabfa-cai").unwrap(), 11000),
        (CanisterId::from_text("xomae-vyaaa-aaaaq-aabhq-cai").unwrap(), 101000),
        (CanisterId::from_text("umz53-fiaaa-aaaaq-aabmq-cai").unwrap(), 101000),
        (CanisterId::from_text("rceqh-cqaaa-aaaaq-aabqa-cai").unwrap(), 101000),
    ];

    mutate_state(|state| {
        for (canister_id, min_dissolve_delay) in min_dissolve_delays {
            state
                .data
                .nervous_systems
                .set_min_dissolve_delay_to_vote(&canister_id, min_dissolve_delay);
        }

        for (canister_id, dissolve_delay) in neuron_dissolve_delays {
            state
                .data
                .nervous_systems
                .mark_neuron_dissolve_delay_increased(&canister_id, dissolve_delay);
        }
        crate::jobs::increase_dissolve_delay::start_job_if_required(state);
    });
}
