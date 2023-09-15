use crate::commands::Command;
use crate::icpswap::ICPSwapClientFactory;
use crate::model::commands_pending::CommandsPending;
use crate::swap_client::{SwapClient, SwapClientFactory};
use candid::Principal;
use canister_state_macros::canister_state;
use exchange_bot_canister::ExchangeId;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use types::{
    BotMessage, BuildVersion, CanisterId, Cryptocurrency, Cycles, MessageContentInitial, MessageId, TextContent,
    TimestampMillis, Timestamped, TokenInfo,
};
use utils::env::Environment;

mod commands;
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

        vec![ICPSwapClientFactory::new().build(this_canister_id, input_token, output_token)]
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

    pub fn enqueue_command(&mut self, command: Command) {
        self.data.commands_pending.push(command);
        // start job
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
    user_index_canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
    cycles_dispenser_canister_id: CanisterId,
    token_info: Vec<TokenInfo>,
    known_callers: HashMap<Principal, bool>,
    commands_pending: CommandsPending,
    username: String,
    display_name: Option<String>,
    is_registered: bool,
    test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            user_index_canister_id,
            local_user_index_canister_id,
            cycles_dispenser_canister_id,
            token_info: build_token_info(),
            known_callers: HashMap::new(),
            commands_pending: CommandsPending::default(),
            username: "".to_string(),
            display_name: None,
            is_registered: false,
            test_mode,
        }
    }

    pub fn get_token_pair(&self, input_token: &str, output_token: &str) -> Result<(TokenInfo, TokenInfo), Vec<String>> {
        match (self.get_token(&input_token), self.get_token(&output_token)) {
            (Some(i), Some(o)) => Ok((i, o)),
            (None, Some(_)) => Err(vec![input_token.to_string()]),
            (Some(_), None) => Err(vec![output_token.to_string()]),
            (None, None) => Err(vec![input_token.to_string(), output_token.to_string()]),
        }
    }

    pub fn get_token(&self, token: &str) -> Option<TokenInfo> {
        let token_upper = token.to_uppercase();

        self.token_info
            .iter()
            .find(|t| t.token.token_symbol().to_uppercase() == token_upper)
            .cloned()
    }

    pub fn supported_tokens(&self) -> Vec<String> {
        self.token_info
            .iter()
            .map(|t| t.token.token_symbol().to_string())
            .sorted_unstable()
            .collect()
    }

    pub fn build_text_response(
        &self,
        text: String,
        message_id: Option<MessageId>,
    ) -> exchange_bot_canister::handle_direct_message::Response {
        self.build_response(MessageContentInitial::Text(TextContent { text }), message_id)
    }

    pub fn build_response(
        &self,
        message: MessageContentInitial,
        message_id: Option<MessageId>,
    ) -> exchange_bot_canister::handle_direct_message::Response {
        let (username, display_name) = (self.username.clone(), self.display_name.clone());

        exchange_bot_canister::handle_direct_message::Response::Success(
            exchange_bot_canister::handle_direct_message::SuccessResult {
                bot_name: username,
                bot_display_name: display_name,
                messages: vec![BotMessage {
                    content: message,
                    message_id,
                }],
            },
        )
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
