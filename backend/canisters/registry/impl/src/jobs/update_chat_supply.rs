use crate::{mutate_state, read_state};
use icrc_ledger_types::icrc1::account::Account;
use std::time::Duration;
use tracing::info;
use types::Timestamped;
use utils::canister_timers::run_now_then_interval;
use utils::consts::{SNS_GOVERNANCE_CANISTER_ID, SNS_LEDGER_CANISTER_ID};
use utils::time::HOUR_IN_MS;

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

    let reserved_accounts: Vec<_> = [
        "d1216f443ead88f8f98a80b2ea59697726f18dffaa58d0a0156d0c605a01b672",
        "bf51477b537b8fc97cff67c13546b05c863cd989fc765b8a88bc8e8e0e9f5716",
        "33188d099055359d6db7e0d3fda880688bbf492fcff54bf87bd4842db8715c42",
        "616cf7d21245ffbbd5bf48a92aa924794c47a5dc2e5d5b2994cd7b03e5c3d18d",
        "0c9288198b6dc21da28113a842f1c6cb4248eb54273f1b2702c12afbeb5b416f",
        "a216f4012a24998c037db6b334642406640c2cedbb84a80ad8f54dbaa0ebeab1",
        "1b750f0a5bbed846a5f59824daf3eaeb4ae2a4a1ceb81ad9f36a1c67b0ffa0e0",
        "005ef4ffe50d9d4d73f08665d7831d3495e3f988a66d6d22f9563a64aa2a7a91",
        "92f7588ca294b88948d99bb322f392ae3345de2e0ae72f6250e51660e55e5a99",
        "56b8c3adaf4ecfc9bb142d6b769bb502b50fb35430274684f0f07feac4a08229",
        "4b0602348f89b48142205d893a71bd33d8f682c296e9a1f3d947e19f8191a790",
        "8aad81c1369fe9644621de21e2eb6eea6e3cce6a4b8b8e11831f41418d7a36f0",
        "6066ff1f82af224a526316857dd8ec44f261b49f7ab44343fe4966a08c734be7",
        "c0e287b65453b7c155de604fd063d0f6da1feacb0bc1ce48fc0d525760fd777f",
        "66b576a92b187684f22b6816697ec19e01b0b328eaf14dd137838a463d49b729",
        "a8b30777cc4ae5eeaaece833ec7dc178a515d4cd433c955d679c504daeb6f226",
        "ae2eb3446bb2fc227260a0b49a0f362d6d0f2eb8f2e6db09530c13606c36120f",
    ]
    .into_iter()
    .map(|sa| Account {
        owner: SNS_GOVERNANCE_CANISTER_ID,
        subaccount: Some(hex::decode(sa).unwrap().try_into().unwrap()),
    })
    .collect();

    let mut reserved = 0;
    for account in reserved_accounts {
        let Ok(balance) = icrc_ledger_canister_c2c_client::icrc1_balance_of(SNS_LEDGER_CANISTER_ID, &account)
            .await
            .map(|b| u128::try_from(b.0).unwrap())
        else {
            return;
        };

        reserved += balance;
    }

    let now = read_state(|state| state.env.now());

    let circulating_supply = total_supply.saturating_sub(reserved);

    mutate_state(|state| {
        state.data.total_supply = Timestamped::new(total_supply, now);
        state.data.circulating_supply = Timestamped::new(circulating_supply, now);
    });

    info!(total_supply, circulating_supply, "CHAT supply updated");
}
