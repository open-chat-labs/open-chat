use crate::commands::Command;
use crate::icpswap::ICPSwapClientFactory;
use crate::model::commands_pending::CommandsPending;
use crate::model::messages_pending::{MessagePending, MessagesPending};
use crate::swap_client::{SwapClient, SwapClientFactory};
use candid::Principal;
use canister_state_macros::canister_state;
use exchange_bot_canister::ExchangeId;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use types::{
    BuildVersion, CanisterId, Cryptocurrency, Cycles, MessageContent, MessageId, TextContent, TimestampMillis, Timestamped,
    TokenInfo, UserId,
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
        jobs::process_commands::start_job_if_required(self);
    }

    pub fn enqueue_message_edit(&mut self, user_id: UserId, message_id: MessageId, text: String) {
        self.enqueue_message(
            user_id,
            message_id,
            MessagePending::Edit(MessageContent::Text(TextContent { text })),
            false,
        );
    }

    pub fn enqueue_message(
        &mut self,
        user_id: UserId,
        message_id: MessageId,
        message: MessagePending,
        skip_if_already_queued: bool,
    ) {
        if !skip_if_already_queued || !self.data.messages_pending.contains(user_id, message_id) {
            self.data.messages_pending.push(user_id, message_id, message);
            jobs::process_messages::start_job_if_required(self);
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            queued_commands: self.data.commands_pending.len() as u32,
            queued_messages: self.data.messages_pending.len() as u32,
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
    messages_pending: MessagesPending,
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
            messages_pending: MessagesPending::default(),
            username: "".to_string(),
            display_name: None,
            is_registered: false,
            test_mode,
        }
    }

    pub fn get_token_pair(&self, input_token: &str, output_token: &str) -> Result<(TokenInfo, TokenInfo), Vec<String>> {
        match (self.get_token(input_token), self.get_token(output_token)) {
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
    pub queued_commands: u32,
    pub queued_messages: u32,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub local_user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
