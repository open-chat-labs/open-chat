use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use registry_canister::post_upgrade::Args;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    if data.test_mode {
        data.group_index_canister_id = CanisterId::from_text("7kifq-3yaaa-aaaaf-ab2cq-cai").unwrap();
        data.notifications_index_canister_id = CanisterId::from_text("4glvk-ryaaa-aaaaf-aaaia-cai").unwrap();
        data.event_relay_canister_id = CanisterId::from_text("6jejw-xyaaa-aaaaf-biiba-cai").unwrap();
        data.escrow_canister_id = CanisterId::from_text("tspqt-xaaaa-aaaal-qcnna-cai").unwrap();
    } else {
        data.group_index_canister_id = CanisterId::from_text("4ijyc-kiaaa-aaaaf-aaaja-cai").unwrap();
        data.notifications_index_canister_id = CanisterId::from_text("7ekiy-aiaaa-aaaaf-ab2dq-cai").unwrap();
        data.event_relay_canister_id = CanisterId::from_text("6ofpc-2aaaa-aaaaf-biibq-cai").unwrap();
        data.escrow_canister_id = CanisterId::from_text("s4yi7-yiaaa-aaaar-qacpq-cai").unwrap();
    }

    // if data.test_mode {
    //     data.subnets
    //         .subnets
    //         .insert(Principal::from_text("eq6en-6jqla-fbu5s-daskr-h6hx2-376n5-iqabl-qgrng-gfqmv-n3yjr-mqe").unwrap());
    // } else {
    //
    //     data.subnets
    //         .subnets
    //         .insert(Principal::from_text("eq6en-6jqla-fbu5s-daskr-h6hx2-376n5-iqabl-qgrng-gfqmv-n3yjr-mqe").unwrap());
    //     data.subnets
    //         .subnets
    //         .insert(Principal::from_text("2fq7c-slacv-26cgz-vzbx2-2jrcs-5edph-i5s2j-tck77-c3rlz-iobzx-mqe").unwrap());
    // }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(set_disabled_tokens_in_escrow_canister()));
}

async fn set_disabled_tokens_in_escrow_canister() {
    let (disabled_tokens, escrow_canister_id) = read_state(|state| {
        let disabled_tokens: Vec<_> = state
            .data
            .tokens
            .iter()
            .filter(|t| !t.enabled)
            .map(|t| t.ledger_canister_id)
            .collect();

        (disabled_tokens, state.data.escrow_canister_id)
    });

    for ledger_canister_id in disabled_tokens {
        escrow_canister_c2c_client::c2c_set_token_enabled(
            escrow_canister_id,
            &escrow_canister::c2c_set_token_enabled::Args {
                ledger_canister_id,
                enabled: false,
            },
        )
        .await
        .unwrap();
    }
}
