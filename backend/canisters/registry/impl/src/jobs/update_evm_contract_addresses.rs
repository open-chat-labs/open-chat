use crate::mutate_state;
use constants::{HOUR_IN_MS, ONE_SEC_MINTER_CANISTER_ID};
use one_sec_minter_canister::Token;
use std::collections::HashMap;
use std::time::Duration;
use types::{CanisterId, Chain, EvmChain, EvmContractAddress};
use utils::canister_timers::run_now_then_interval;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(17 * HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::futures::spawn(run_async());
}

async fn run_async() {
    let Ok(Ok(metadata)) = one_sec_minter_canister_c2c_client::get_metadata(ONE_SEC_MINTER_CANISTER_ID).await else {
        return;
    };

    let mut token_to_ledger: HashMap<Token, CanisterId> = HashMap::new();
    let mut token_to_evm_contract_addresses: HashMap<Token, Vec<EvmContractAddress>> = HashMap::new();
    for value in metadata.tokens {
        let Some(token) = value.token else {
            continue;
        };
        let Some(chain) = value.chain else {
            continue;
        };
        if chain == Chain::ICP {
            token_to_ledger.insert(token, CanisterId::from_text(value.contract).unwrap());
        } else if let Ok(evm_chain) = EvmChain::try_from(chain) {
            token_to_evm_contract_addresses
                .entry(token)
                .or_default()
                .push(EvmContractAddress {
                    chain: evm_chain,
                    address: value.contract,
                });
        }
    }

    let mut evm_contract_addresses = HashMap::new();
    for (token, ledger) in token_to_ledger {
        if let Some(addresses) = token_to_evm_contract_addresses.remove(&token) {
            evm_contract_addresses.insert(ledger, addresses);
        }
    }

    mutate_state(|state| {
        state.data.evm_contract_addresses = evm_contract_addresses;
    });
}
