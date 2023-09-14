use crate::icpswap::ICPSwapClientFactory;
use crate::swap_client::{SwapClient, SwapClientFactory};
use candid::Principal;
use canister_state_macros::canister_state;
use exchange_bot_canister::ExchangeId;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use types::{BuildVersion, CanisterId, Cryptocurrency, Cycles, TimestampMillis, Timestamped, TokenInfo};
use utils::env::Environment;

mod guards;
mod icpswap;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod swap_client;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn get_all_swap_clients(&self, input_token: TokenInfo, output_token: TokenInfo) -> Vec<Box<dyn SwapClient>> {
        let this_canister_id = self.env.canister_id();

        vec![ICPSwapClientFactory::new().build(this_canister_id, input_token.clone(), output_token.clone())]
            .into_iter()
            .flatten()
            .collect()
    }

    pub fn get_swap_client(
        &self,
        exchange_id: ExchangeId,
        input_token: TokenInfo,
        output_token: TokenInfo,
    ) -> Option<Box<dyn SwapClient>> {
        let this_canister_id = self.env.canister_id();

        match exchange_id {
            ExchangeId::ICPSwap => ICPSwapClientFactory::new().build(this_canister_id, input_token, output_token),
        }
    }

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            canister_ids: CanisterIds {
                local_user_index: self.data.local_user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    governance_principals: HashSet<Principal>,
    local_user_index_canister_id: CanisterId,
    cycles_dispenser_canister_id: CanisterId,
    token_info: HashMap<CanisterId, TokenInfo>,
    test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        local_user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            local_user_index_canister_id,
            cycles_dispenser_canister_id,
            token_info: build_token_info().into_iter().map(|t| (t.ledger, t)).collect(),
            test_mode,
        }
    }

    pub fn get_token_info(
        &self,
        input_token: CanisterId,
        output_token: CanisterId,
    ) -> Result<(TokenInfo, TokenInfo), Vec<CanisterId>> {
        match (self.token_info.get(&input_token), self.token_info.get(&output_token)) {
            (Some(i), Some(o)) => Ok((i.clone(), o.clone())),
            (None, Some(_)) => Err(vec![input_token]),
            (Some(_), None) => Err(vec![output_token]),
            (None, None) => Err(vec![input_token, output_token]),
        }
    }
}

fn build_token_info() -> Vec<TokenInfo> {
    vec![
        TokenInfo {
            token: Cryptocurrency::InternetComputer,
            ledger: Cryptocurrency::InternetComputer.ledger_canister_id().unwrap(),
            decimals: 8,
            fee: 10_000,
        },
        TokenInfo {
            token: Cryptocurrency::CHAT,
            ledger: Cryptocurrency::CHAT.ledger_canister_id().unwrap(),
            decimals: 8,
            fee: 100_000,
        },
    ]
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub governance_principals: Vec<Principal>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub local_user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
