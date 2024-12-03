use std::time::Duration;

use crate::lifecycle::{init_env, init_state};
use crate::updates::add_token::add_token_impl;
use crate::Data;
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk::init;
use registry_canister::init::Args;
use tracing::{error, info};
use utils::cycles::init_cycles_dispenser_client;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    init_cycles_dispenser_client(args.cycles_dispenser_canister_id, args.test_mode);

    let env = init_env([0; 32]);
    let mut data = Data::new(
        args.governance_principals.into_iter().collect(),
        args.proposals_bot_canister_id,
        args.user_index_canister_id,
        args.sns_wasm_canister_id,
        args.cycles_dispenser_canister_id,
        args.test_mode,
    );

    data.add_icp_token_details(
        args.nns_ledger_canister_id,
        args.nns_root_canister_id,
        args.nns_governance_canister_id,
        args.nns_index_canister_id,
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");

    ic_cdk_timers::set_timer(Duration::ZERO, add_token);
}

fn add_token() {
    ic_cdk::spawn(add_token_inner());

    async fn add_token_inner() {
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
