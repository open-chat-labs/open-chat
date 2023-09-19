use crate::commands::common_errors::CommonErrors;
use crate::commands::sub_tasks::get_quotes::get_quotes;
use crate::commands::{build_error_response, Command, CommandParser, CommandSubTaskResult, ParseMessageResult};
use crate::swap_client::SwapClient;
use crate::{mutate_state, RuntimeState};
use exchange_bot_canister::ExchangeId;
use lazy_static::lazy_static;
use ledger_utils::format_crypto_amount;
use rand::Rng;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use types::{MessageContent, MessageId, TimestampMillis, TokenInfo, UserId};

lazy_static! {
    static ref REGEX: Regex =
        RegexBuilder::new(r"^quote\s+(?<input_token>\S+)\s+(?<output_token>\S+)(\s+(?<amount>[\d.,]+))?$")
            .case_insensitive(true)
            .build()
            .unwrap();
}

pub struct QuoteCommandParser;

impl CommandParser for QuoteCommandParser {
    fn help_text() -> &'static str {
        "**QUOTE**

format: 'quote $InputToken $OutputToken $Amount'
eg. 'quote ICP CHAT 100'
$Amount will default to 1 if not provided."
    }

    fn try_parse(message: &MessageContent, state: &mut RuntimeState) -> ParseMessageResult {
        let text = message.text().unwrap_or_default();

        if !REGEX.is_match(text) {
            return ParseMessageResult::DoesNotMatch;
        }

        let matches = REGEX.captures_iter(text).next().unwrap();
        let input_token = &matches["input_token"];
        let output_token = &matches["output_token"];
        let amount_decimal = matches
            .name("amount")
            .map(|m| f64::from_str(m.as_str()).unwrap())
            .unwrap_or(1.0);

        let (input_token, output_token) = match state.data.get_token_pair(input_token, output_token) {
            Ok((i, o)) => (i, o),
            Err(tokens) => {
                let error = CommonErrors::UnsupportedTokens(tokens);
                return build_error_response(error, &state.data);
            }
        };

        let amount = (amount_decimal * 10u128.pow(input_token.decimals as u32) as f64) as u128;

        match QuoteCommand::build(input_token, output_token, amount, state) {
            Ok(command) => ParseMessageResult::Success(Command::Quote(Box::new(command))),
            Err(error) => build_error_response(error, &state.data),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct QuoteCommand {
    pub created: TimestampMillis,
    pub user_id: UserId,
    pub input_token: TokenInfo,
    pub output_token: TokenInfo,
    pub amount: u128,
    pub exchange_ids: Vec<ExchangeId>,
    pub message_id: MessageId,
    pub results: Vec<(ExchangeId, CommandSubTaskResult<u128>)>,
}

impl QuoteCommand {
    pub(crate) fn build(
        input_token: TokenInfo,
        output_token: TokenInfo,
        amount: u128,
        state: &mut RuntimeState,
    ) -> Result<QuoteCommand, CommonErrors> {
        let clients = state.get_all_swap_clients(input_token.clone(), output_token.clone());

        if !clients.is_empty() {
            let quote_statuses = clients
                .iter()
                .map(|c| (c.exchange_id(), CommandSubTaskResult::Pending))
                .collect();

            Ok(QuoteCommand {
                created: state.env.now(),
                user_id: state.env.caller().into(),
                input_token,
                output_token,
                amount,
                exchange_ids: clients.iter().map(|c| c.exchange_id()).collect(),
                message_id: state.env.rng().gen(),
                results: quote_statuses,
            })
        } else {
            Err(CommonErrors::PairNotSupported)
        }
    }

    pub(crate) fn process(self, state: &mut RuntimeState) {
        let amount = self.amount;
        let clients: Vec<_> = self
            .exchange_ids
            .iter()
            .filter_map(|e| state.get_swap_client(*e, self.input_token.clone(), self.output_token.clone()))
            .collect();

        ic_cdk::spawn(self.get_quotes(clients, amount));
    }

    pub fn build_message_text(&self) -> String {
        let mut text = format!(
            "Quotes ({} {} to {}):",
            format_crypto_amount(self.amount, self.input_token.decimals),
            self.input_token.token.token_symbol(),
            self.output_token.token.token_symbol()
        );
        for (exchange_id, status) in self.results.iter() {
            let exchange_name = exchange_id.to_string();
            let status_text = status.to_string();
            text.push_str(&format!("\n{exchange_name}: {status_text}"));
        }
        text
    }

    async fn get_quotes(mut self, clients: Vec<Box<dyn SwapClient>>, amount: u128) {
        get_quotes(clients, amount, self.output_token.decimals, |exchange_id, result| {
            self.set_quote_result(exchange_id, result);
            let message_text = self.build_message_text();
            mutate_state(|state| {
                state.enqueue_message_edit(self.user_id, self.message_id, message_text);
            });
        })
        .await
    }

    fn set_quote_result(&mut self, exchange_id: ExchangeId, result: CommandSubTaskResult<u128>) {
        if let Some(r) = self.results.iter_mut().find(|(e, _)| *e == exchange_id).map(|(_, s)| s) {
            *r = result;
        }
    }
}
