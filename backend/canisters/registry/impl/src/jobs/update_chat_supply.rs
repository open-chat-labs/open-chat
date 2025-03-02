use crate::mutate_state;
use candid::Principal;
use constants::{HOUR_IN_MS, SNS_GOVERNANCE_CANISTER_ID, SNS_LEDGER_CANISTER_ID};
use ic_cdk::call::RejectCode;
use icrc_ledger_types::icrc1::account::Account;
use sha256::sha256;
use sns_governance_canister::types::NeuronId;
use std::collections::HashSet;
use std::time::Duration;
use tracing::info;
use types::Timestamped;
use utils::canister_timers::run_now_then_interval;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::futures::spawn(async {
        let _ = run_async().await;
    });
}

async fn run_async() -> Result<(), (RejectCode, String)> {
    let total_supply = icrc_ledger_canister_c2c_client::icrc1_total_supply(SNS_LEDGER_CANISTER_ID)
        .await
        .map(|s| u128::try_from(s.0).unwrap())?;

    let insiders: Vec<_> = [
        "zeu5w-lsfxj-o4f5b-xl4sg-enqva-ez4wa-2nlbb-ufigi-fwnmv-zrfok-uae", // Hamish
        "liskq-yvpvq-eo6av-3gaz6-izybe-x74ku-t42w5-si5dq-eitcy-sih4g-lqe", // Matt
        "4s36z-lcydz-e4ts5-nuzlo-h3ksp-uu4fe-xndls-pq6ah-mmv5k-x5rjw-hqe", // Julian
        "n2xex-iyaaa-aaaar-qaaeq-cai",                                     // Dfinity
    ]
    .into_iter()
    .map(|s| Principal::from_text(s).unwrap())
    .collect();

    let mut reserved_subaccounts: HashSet<[u8; 32]> = HashSet::new();
    reserved_subaccounts.insert(compute_treasury_subaccount());
    for principal in insiders {
        for neuron_id in neuron_ids_by_principal(principal).await? {
            reserved_subaccounts.insert(neuron_id.id.try_into().unwrap());
        }
    }

    let mut reserved = 0;
    for subaccount in reserved_subaccounts {
        let balance = icrc_ledger_canister_c2c_client::icrc1_balance_of(
            SNS_LEDGER_CANISTER_ID,
            &Account {
                owner: SNS_GOVERNANCE_CANISTER_ID,
                subaccount: Some(subaccount),
            },
        )
        .await
        .map(|b| u128::try_from(b.0).unwrap())?;

        reserved += balance;
    }

    let circulating_supply = total_supply.saturating_sub(reserved);

    mutate_state(|state| {
        let now = state.env.now();
        state.data.total_supply = Timestamped::new(total_supply, now);
        state.data.circulating_supply = Timestamped::new(circulating_supply, now);
    });

    info!(total_supply, circulating_supply, "CHAT supply updated");
    Ok(())
}

async fn neuron_ids_by_principal(principal: Principal) -> Result<Vec<NeuronId>, (RejectCode, String)> {
    let mut neuron_ids = Vec::new();

    loop {
        let response = sns_governance_canister_c2c_client::list_neurons(
            SNS_GOVERNANCE_CANISTER_ID,
            &sns_governance_canister::list_neurons::Args {
                of_principal: Some(principal),
                limit: 20,
                start_page_at: neuron_ids.last().cloned(),
            },
        )
        .await?;

        let count = response.neurons.len();
        neuron_ids.extend(response.neurons.into_iter().map(|n| n.id.unwrap()));

        if count < 20 {
            break;
        }
    }

    Ok(neuron_ids)
}

fn compute_treasury_subaccount() -> [u8; 32] {
    const DOMAIN: &[u8] = b"token-distribution";
    const DOMAIN_LENGTH: [u8; 1] = [0x12];

    let principal = SNS_GOVERNANCE_CANISTER_ID;
    let nonce = 0u64;

    let mut bytes = Vec::new();
    bytes.extend_from_slice(&DOMAIN_LENGTH);
    bytes.extend_from_slice(DOMAIN);
    bytes.extend_from_slice(principal.as_slice());
    bytes.extend_from_slice(&nonce.to_be_bytes());
    sha256(&bytes)
}
