use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{Data, LOG_MESSAGES};
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use tracing::info;
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
    init_swap_group_controller_queue(&mut data);

    init_logger(data.test_mode);
    init_state(env, data, args.wasm_version);

    if !log_messages.is_empty() || !trace_messages.is_empty() {
        LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
    }

    cycles_dispenser_client::init_from_bytes(&cycles_dispenser_client_state);
    cycles_dispenser_client::set_min_cycles_balance(3 * MIN_CYCLES_BALANCE / 2);

    info!(version = %args.wasm_version, "Post-upgrade complete");
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

fn init_swap_group_controller_queue(data: &mut Data) {
    let private_groups = data.private_groups.iter().map(|g| g.id());
    let public_groups = data.public_groups.iter().map(|g| g.id());
    for id in private_groups.chain(public_groups) {
        data.canisters_requiring_controller_swap.enqueue(id.into());
    }
    let canisters_queued_for_swap = data.canisters_requiring_controller_swap.count_pending();
    info!(canisters_queued_for_swap, "Group canister controller swap initiated");
}
