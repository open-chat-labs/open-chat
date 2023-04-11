use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use tracing::info;
use types::{Cryptocurrency, DiamondMembershipPlanDuration};
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::Environment;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (mut data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    for user in data.users.iter() {
        let now = env.now();
        if let Some(expires_at) = user.diamond_membership_details.expires_at().filter(|ts| now < *ts) {
            if let Some(index) = data.local_index_map.get_index_canister(&user.user_id) {
                data.user_index_event_sync_queue.push(
                    index,
                    local_user_index_canister::Event::DiamondMembershipPaymentReceived(
                        // Using dummy values since this is a one time job and we currently only use
                        // the `expires_at` value
                        local_user_index_canister::DiamondMembershipPaymentReceived {
                            user_id: user.user_id,
                            timestamp: now,
                            expires_at,
                            token: Cryptocurrency::InternetComputer,
                            amount_e8s: 0,
                            block_index: 0,
                            duration: DiamondMembershipPlanDuration::OneMonth,
                            recurring: false,
                            send_bot_message: false,
                        },
                    ),
                );
            }
        }
    }

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
