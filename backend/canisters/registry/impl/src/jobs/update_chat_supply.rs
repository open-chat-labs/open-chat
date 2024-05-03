use crate::{mutate_state, read_state};
use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;
use sha256::sha256;
use std::time::Duration;
use types::{Milliseconds, TimestampMillis, Timestamped};
use utils::canister_timers::run_now_then_interval;
use utils::consts::{SNS_GOVERNANCE_CANISTER_ID, SNS_LEDGER_CANISTER_ID};
use utils::time::HOUR_IN_MS;

const ONE_CHAT: u128 = 100_000_000;
const SNS_CREATED: TimestampMillis = 1_677_260_000_000;
const ONE_YEAR: Milliseconds = 31_536_000_000;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::spawn(run_async());
}

async fn run_async() {
    let Ok(total_supply) = icrc_ledger_canister_c2c_client::icrc1_total_supply(SNS_LEDGER_CANISTER_ID)
        .await
        .map(|s| u128::try_from(s.0).unwrap())
    else {
        return;
    };

    let Ok(treasury_balance) = icrc_ledger_canister_c2c_client::icrc1_balance_of(
        SNS_LEDGER_CANISTER_ID,
        &Account {
            owner: SNS_GOVERNANCE_CANISTER_ID,
            subaccount: Some(compute_distribution_subaccount_bytes(SNS_GOVERNANCE_CANISTER_ID, 0)),
        },
    )
    .await
    .map(|b| u128::try_from(b.0).unwrap()) else {
        return;
    };

    let now = read_state(|state| state.env.now());

    // Each of the 3 members of the founding dev team initially received 5 neurons, each with a
    // stake of 1M CHAT, with vesting periods of 0, 1, 2, 3 and 4 years. These tokens are excluded
    // from the circulating supply until they vest.
    let mut vesting = 0;
    if now < SNS_CREATED + (4 * ONE_YEAR) {
        vesting += 3_000_000 * ONE_CHAT;

        if now < SNS_CREATED + (3 * ONE_YEAR) {
            vesting += 3_000_000 * ONE_CHAT;

            if now < SNS_CREATED + (2 * ONE_YEAR) {
                vesting += 3_000_000 * ONE_CHAT;

                if now < SNS_CREATED + ONE_YEAR {
                    vesting += 3_000_000 * ONE_CHAT;
                }
            }
        }
    }

    let circulating_supply = total_supply.saturating_sub(treasury_balance).saturating_sub(vesting);

    mutate_state(|state| {
        state.data.total_supply = Timestamped::new(total_supply, now);
        state.data.circulating_supply = Timestamped::new(circulating_supply, now);
    });
}

fn compute_distribution_subaccount_bytes(principal_id: Principal, nonce: u64) -> [u8; 32] {
    const DOMAIN: &[u8] = b"token-distribution";
    const DOMAIN_LENGTH: [u8; 1] = [0x12];

    let mut bytes = Vec::new();
    bytes.extend_from_slice(&DOMAIN_LENGTH);
    bytes.extend_from_slice(DOMAIN);
    bytes.extend_from_slice(principal_id.as_slice());
    bytes.extend_from_slice(&nonce.to_be_bytes());
    sha256(&bytes)
}
