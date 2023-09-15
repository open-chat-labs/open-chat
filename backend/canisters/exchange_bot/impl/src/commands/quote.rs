use crate::commands::common_errors::CommonErrors;
use crate::commands::{Command, CommandParser, ParseMessageResult};
use crate::swap_client::SwapClient;
use crate::{Data, RuntimeState};
use exchange_bot_canister::ExchangeId;
use itertools::Itertools;
use lazy_static::lazy_static;
use rand::Rng;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;
use types::{MessageContent, MessageContentInitial, MessageId, TextContent, TimestampMillis, TokenInfo, UserId};

lazy_static! {
    static ref REGEX: Regex = RegexBuilder::new(r"quote (?<input_token>\S+) (?<output_token>\S+) (?<amount>[\d.,]+)")
        .case_insensitive(true)
        .build()
        .unwrap();
}

pub struct QuoteCommandParser;

impl CommandParser for QuoteCommandParser {
    fn try_parse(message: &MessageContent, state: &mut RuntimeState) -> ParseMessageResult {
        let text = message.text().unwrap_or_default();

        if !REGEX.is_match(&text) {
            return ParseMessageResult::DoesNotMatch;
        }

        let matches = REGEX.captures_iter(&text).next().unwrap();
        let input_token = &matches["input_token"];
        let output_token = &matches["output_token"];
        let amount_decimal = f64::from_str(&matches["amount"]).unwrap();

        let (input_token, output_token) = match state.data.get_token_pair(input_token, output_token) {
            Ok((i, o)) => (i, o),
            Err(tokens) => {
                let error = CommonErrors::UnsupportedTokens(tokens);
                return build_error_response(error, &state.data);
            }
        };

        let amount = (amount_decimal * 10u128.pow(input_token.decimals as u32) as f64) as u128;

        match QuoteCommand::build(input_token, output_token, amount, state) {
            Ok(command) => ParseMessageResult::Success(Command::Quote(command)),
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
    pub clients: Vec<Box<dyn SwapClient>>,
    pub message_id: MessageId,
    pub quote_statuses: Vec<(ExchangeId, QuoteStatus)>,
    pub in_progress: Option<TimestampMillis>, // The time it started being processed
}

#[derive(Serialize, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq)]
pub enum QuoteStatus {
    Success(u128, String),
    Failed(String),
    Pending,
}

impl Display for QuoteStatus {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            QuoteStatus::Success(_, text) => f.write_str(&text),
            QuoteStatus::Failed(_) => f.write_str("Failed"),
            QuoteStatus::Pending => f.write_str("Pending"),
        }
    }
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
            let quote_statuses = clients.iter().map(|c| (c.exchange_id(), QuoteStatus::Pending)).collect();

            Ok(QuoteCommand {
                created: state.env.now(),
                user_id: state.env.caller().into(),
                input_token,
                output_token,
                amount,
                clients,
                message_id: state.env.rng().gen(),
                quote_statuses,
                in_progress: None,
            })
        } else {
            Err(CommonErrors::PairNotSupported)
        }
    }

    pub fn build_message(&self) -> MessageContentInitial {
        let mut text = "Quotes:".to_string();
        for (exchange_id, status) in self.quote_statuses.iter().sorted_unstable_by_key(|(_, s)| s) {
            let exchange_name = exchange_id.to_string();
            let status_text = status.to_string();
            text.push_str(&format!("\n{exchange_name}: {status_text}"));
        }

        MessageContentInitial::Text(TextContent { text })
    }
}

fn build_error_response(error: CommonErrors, data: &Data) -> ParseMessageResult {
    let response_message = error.build_response_message(data);
    ParseMessageResult::Error(data.build_text_response(response_message, None))
}
