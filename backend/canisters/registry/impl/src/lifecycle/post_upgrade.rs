use std::time::Duration;

use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::updates::add_token::add_token_impl;
use crate::{read_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use registry_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::{error, info};
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    ic_cdk_timers::set_timer(Duration::ZERO, add_token);
}

fn add_token() {
    ic_cdk::spawn(add_token_inner());

    async fn add_token_inner() {
        if read_state(|state| state.data.test_mode) {
            return;
        }

        let ledger_canister_id = Principal::from_text("npnnq-naaaa-aaaam-qb7va-cai").unwrap();
        let payer = Principal::from_text("icbn4-5qaaa-aaaaf-bp72q-cai").unwrap().into();
        let info_url = "https://info.icpswap.com/token/details/npnnq-naaaa-aaaam-qb7va-cai".to_string();
        let how_to_buy_url =
            "https://app.icpswap.com/swap?input=ryjl3-tyaaa-aaaaa-aaaba-cai&output=npnnq-naaaa-aaaam-qb7va-cai".to_string();
        let transaction_url_format = "https://ic.house/token/npnnq-naaaa-aaaam-qb7va-cai".to_string();

        let response = add_token_impl(
            ledger_canister_id,
            Some(payer),
            None,
            Some(info_url),
            Some(how_to_buy_url),
            Some(transaction_url_format),
            None,
        )
        .await;

        match response {
            registry_canister::add_token::Response::Success => {
                info!("AWB added");
            }
            _ => error!("Failed to add AWB: {response:?}"),
        }
    }
}
