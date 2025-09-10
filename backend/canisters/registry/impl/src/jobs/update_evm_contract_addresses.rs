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
        let previous_addresses = std::mem::replace(&mut state.data.evm_contract_addresses, evm_contract_addresses);

        let mut tokens_with_updates = Vec::new();

        // Add the tokens which previously didn't have any EVM contract addresses
        tokens_with_updates.extend(
            state
                .data
                .evm_contract_addresses
                .keys()
                .filter(|a| !previous_addresses.contains_key(a)),
        );

        // Add the tokens where the list of EVM contract addresses has changed
        for (ledger_canister_id, previous_addresses) in previous_addresses {
            if state
                .data
                .evm_contract_addresses
                .get(&ledger_canister_id)
                .is_none_or(|new_addresses| {
                    previous_addresses.len() != new_addresses.len()
                        || previous_addresses.iter().any(|a| !new_addresses.contains(a))
                })
            {
                tokens_with_updates.push(ledger_canister_id);
            }
        }

        if !tokens_with_updates.is_empty() {
            let now = state.env.now();

            for ledger_canister_id in tokens_with_updates {
                state.data.tokens.set_evm_contract_addresses(
                    ledger_canister_id,
                    state
                        .data
                        .evm_contract_addresses
                        .get(&ledger_canister_id)
                        .cloned()
                        .unwrap_or_default(),
                    now,
                );
            }
        }
    });
}
