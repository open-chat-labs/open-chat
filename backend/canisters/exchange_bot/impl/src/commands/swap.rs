use crate::commands::common_errors::CommonErrors;
use crate::commands::sub_tasks::check_user_balance::check_user_balance;
use crate::commands::sub_tasks::get_quotes::get_quote;
use crate::commands::{Command, CommandParser, CommandSubTaskResult, ParseMessageResult};
use crate::swap_client::SwapClient;
use crate::{mutate_state, Data, RuntimeState};
use exchange_bot_canister::ExchangeId;
use lazy_static::lazy_static;
use rand::Rng;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use types::icrc1::BlockIndex;
use types::{CanisterId, MessageContent, MessageId, TimestampMillis, TokenInfo, UserId};

lazy_static! {
    static ref REGEX: Regex = RegexBuilder::new(r"swap\s+(?<input_token>\S+)\s+(?<output_token>\S+)(\s+(?<amount>[\d.,]+))?")
        .case_insensitive(true)
        .build()
        .unwrap();
}

pub struct SwapCommandParser;

impl CommandParser for SwapCommandParser {
    fn help_text() -> &'static str {
        "**SWAP**

format: 'quote $InputToken $OutputToken $Amount'

eg. 'swap ICP CHAT 100'

If $'Amount' is not provided, the full balance of $InputTokens will be swapped."
    }

    fn try_parse(message: &MessageContent, state: &mut RuntimeState) -> ParseMessageResult {
        let text = message.text().unwrap_or_default();

        if !REGEX.is_match(text) {
            return ParseMessageResult::DoesNotMatch;
        }

        let matches = REGEX.captures_iter(text).next().unwrap();
        let input_token = &matches["input_token"];
        let output_token = &matches["output_token"];
        let amount_decimal = matches.name("amount").map(|m| f64::from_str(m.as_str()).unwrap());

        let (input_token, output_token) = match state.data.get_token_pair(input_token, output_token) {
            Ok((i, o)) => (i, o),
            Err(tokens) => {
                let error = CommonErrors::UnsupportedTokens(tokens);
                return build_error_response(error, &state.data);
            }
        };

        let amount = amount_decimal.map(|a| (a * 10u128.pow(input_token.decimals as u32) as f64) as u128);

        match SwapCommand::build(input_token, output_token, amount, state) {
            Ok(command) => ParseMessageResult::Success(Command::Swap(command)),
            Err(error) => build_error_response(error, &state.data),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct SwapCommand {
    pub created: TimestampMillis,
    pub user_id: UserId,
    pub input_token: TokenInfo,
    pub output_token: TokenInfo,
    pub amount_provided: Option<u128>,
    pub message_id: MessageId,
    pub exchange_ids: Vec<ExchangeId>,
    pub quotes: Vec<(ExchangeId, CommandSubTaskResult<u128>)>,
    pub sub_tasks: SwapCommandSubTasks,
}

#[derive(Serialize, Deserialize, Default)]
pub struct SwapCommandSubTasks {
    pub check_user_balance: CommandSubTaskResult<u128>,
    pub quotes: CommandSubTaskResult<ExchangeId>,
    pub transfer_to_dex: CommandSubTaskResult<BlockIndex>,
    pub notify_dex: CommandSubTaskResult<u128>,
    pub swap: CommandSubTaskResult<u128>,
    pub withdraw: CommandSubTaskResult<BlockIndex>,
}

impl SwapCommand {
    pub(crate) fn build(
        input_token: TokenInfo,
        output_token: TokenInfo,
        amount: Option<u128>,
        state: &mut RuntimeState,
    ) -> Result<SwapCommand, CommonErrors> {
        let clients = state.get_all_swap_clients(input_token.clone(), output_token.clone());

        if !clients.is_empty() {
            let quotes = clients
                .iter()
                .map(|c| (c.exchange_id(), CommandSubTaskResult::Pending))
                .collect();

            Ok(SwapCommand {
                created: state.env.now(),
                user_id: state.env.caller().into(),
                input_token,
                output_token,
                amount_provided: amount,
                message_id: state.env.rng().gen(),
                exchange_ids: clients.iter().map(|c| c.exchange_id()).collect(),
                quotes,
                sub_tasks: SwapCommandSubTasks {
                    check_user_balance: if amount.is_some() {
                        CommandSubTaskResult::Pending
                    } else {
                        CommandSubTaskResult::NotRequired
                    },
                    ..Default::default()
                },
            })
        } else {
            Err(CommonErrors::PairNotSupported)
        }
    }

    pub(crate) fn process(self, state: &mut RuntimeState) {
        if self.sub_tasks.check_user_balance.is_pending() {
            ic_cdk::spawn(self.check_user_balance(state.env.canister_id()));
        } else if let Some(amount) = self.sub_tasks.quotes.is_pending().then_some(self.amount()).flatten() {
            let clients: Vec<_> = self
                .exchange_ids
                .iter()
                .filter_map(|e| state.get_swap_client(*e, self.input_token.clone(), self.output_token.clone()))
                .collect();

            ic_cdk::spawn(get_quotes(self, clients, amount));
        }
    }

    pub fn build_message_text(&self) -> String {
        let text = "Quotes:".to_string();
        // for (exchange_id, status) in self.quote_statuses.iter().sorted_unstable_by_key(|(_, s)| s) {
        //     let exchange_name = exchange_id.to_string();
        //     let status_text = status.to_string();
        //     text.push_str(&format!("\n{exchange_name}: {status_text}"));
        // }
        text
    }

    async fn check_user_balance(mut self, this_canister_id: CanisterId) {
        self.sub_tasks.check_user_balance = check_user_balance(self.user_id, &self.input_token, this_canister_id).await;

        mutate_state(|state| self.on_updated(state));
    }

    fn on_updated(self, state: &mut RuntimeState) {
        let is_finished = self.is_finished();

        let message_text = self.build_message_text();
        state.enqueue_message_edit(self.user_id, self.message_id, message_text);

        if !is_finished {
            state.enqueue_command(Command::Swap(self));
        }
    }

    fn set_quote_result(&mut self, exchange_id: ExchangeId, result: CommandSubTaskResult<u128>) {
        if let Some(r) = self.quotes.iter_mut().find(|(e, _)| *e == exchange_id).map(|(_, s)| s) {
            *r = result;
        }
    }

    fn amount(&self) -> Option<u128> {
        if let Some(a) = self.amount_provided {
            Some(a)
        } else if let CommandSubTaskResult::Complete(a, _) = self.sub_tasks.check_user_balance {
            Some(a.saturating_sub(self.input_token.fee))
        } else {
            None
        }
    }

    fn is_finished(&self) -> bool {
        !self.sub_tasks.withdraw.is_pending()
    }
}

async fn get_quotes(command: SwapCommand, clients: Vec<Box<dyn SwapClient>>, amount: u128) {
    let output_token_decimals = command.output_token.decimals;
    let wrapped_command = Arc::new(Mutex::new(command));

    let futures: Vec<_> = clients
        .into_iter()
        .map(|c| quote_single(c, amount, output_token_decimals, wrapped_command.clone()))
        .collect();

    futures::future::join_all(futures).await;

    let mut command = Arc::try_unwrap(wrapped_command)
        .map_err(|_| ())
        .unwrap()
        .into_inner()
        .unwrap();

    if let Some((exchange_id, CommandSubTaskResult::Complete(..))) = command.quotes.iter().max_by_key(|(_, r)| r.value()) {
        command.sub_tasks.quotes = CommandSubTaskResult::Complete(*exchange_id, Some(exchange_id.to_string()));
    } else {
        command.sub_tasks.quotes = CommandSubTaskResult::Failed("Failed to get any valid quotes".to_string());
    }

    mutate_state(|state| command.on_updated(state));
}

async fn quote_single(
    client: Box<dyn SwapClient>,
    amount: u128,
    output_token_decimals: u8,
    wrapped_command: Arc<Mutex<SwapCommand>>,
) {
    let result = get_quote(client.as_ref(), amount, output_token_decimals).await;

    let mut command = wrapped_command.lock().unwrap();
    command.set_quote_result(client.exchange_id(), result);

    let message_text = command.build_message_text();

    mutate_state(|state| {
        state.enqueue_message_edit(command.user_id, command.message_id, message_text);
    })
}

fn build_error_response(error: CommonErrors, data: &Data) -> ParseMessageResult {
    let response_message = error.build_response_message(data);
    ParseMessageResult::Error(data.build_text_response(response_message, None))
}
