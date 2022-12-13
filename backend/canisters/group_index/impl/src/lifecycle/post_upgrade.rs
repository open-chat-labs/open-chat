use std::time::Duration;

use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{mutate_state, read_state, Data, LOG_MESSAGES};
use candid::Principal;
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use local_group_index_canister::c2c_add_initial_groups::Group;
use stable_memory::deserialize_from_stable_memory;
use tracing::{error, info};
use utils::consts::MIN_CYCLES_BALANCE;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (mut data, log_messages, trace_messages, cycles_dispenser_client_state): (
        Data,
        Vec<LogMessage>,
        Vec<LogMessage>,
        Vec<u8>,
    ) = deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    data.public_groups.hydrate();
    data.canisters_requiring_upgrade.reset_in_progress();

    init_logger(data.test_mode);
    init_state(env, data, args.wasm_version);

    if !log_messages.is_empty() || !trace_messages.is_empty() {
        LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
    }

    cycles_dispenser_client::init_from_bytes(&cycles_dispenser_client_state);
    cycles_dispenser_client::set_min_cycles_balance(3 * MIN_CYCLES_BALANCE / 2);

    // One-time job to load the local_group_index with the groups
    ic_cdk::timer::set_timer(Duration::ZERO, || {
        ic_cdk::spawn(bootstrap_local_group_index());
    });

    info!(version = %args.wasm_version, "Post-upgrade complete");
}

pub async fn bootstrap_local_group_index() {
    let groups: Vec<_> = read_state(|state| {
        let private_groups = state.data.private_groups.iter().map(|g| Group {
            chat_id: g.id(),
            wasm_version: g.wasm_version(),
        });
        let public_groups = state.data.public_groups.iter().map(|g| Group {
            chat_id: g.id(),
            wasm_version: g.wasm_version(),
        });
        private_groups.chain(public_groups).collect()
    });

    let group_ids: Vec<_> = groups.iter().map(|g| g.chat_id).collect();

    let index_id: Principal = Principal::from_text("first_local_group_index_id").unwrap();

    match local_group_index_canister_c2c_client::c2c_add_initial_groups(
        index_id,
        &local_group_index_canister::c2c_add_initial_groups::Args { groups },
    )
    .await
    {
        Ok(_) => {
            mutate_state(|state| {
                state.data.local_index_map.add_index(index_id);
                for chat_id in group_ids {
                    state.data.local_index_map.add_group(index_id, chat_id);
                }
            });
        }
        Err(error) => {
            error!(?error, "Error calling c2c_notify_group_index_events");
        }
    }
}

fn rehydrate_log_messages(
    log_messages: Vec<LogMessage>,
    trace_messages: Vec<LogMessage>,
    messages_container: &LogMessagesWrapper,
) {
    for message in log_messages {
        messages_container.logs.push(message);
    }

    for message in trace_messages {
        messages_container.traces.push(message);
    }
}
