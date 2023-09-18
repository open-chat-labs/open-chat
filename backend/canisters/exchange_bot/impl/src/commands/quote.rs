use crate::commands::common_errors::CommonErrors;
use crate::commands::{build_error_response, Command, CommandParser, ParseMessageResult};
use crate::swap_client::SwapClient;
use crate::{mutate_state, RuntimeState};
use exchange_bot_canister::ExchangeId;
use itertools::Itertools;
use lazy_static::lazy_static;
use ledger_utils::format_crypto_amount;
use rand::Rng;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
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
'$Amount' will default to 1 if not provided."
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
    pub exchange_ids: Vec<ExchangeId>,
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
            QuoteStatus::Success(_, text) => f.write_str(text),
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
                exchange_ids: clients.iter().map(|c| c.exchange_id()).collect(),
                message_id: state.env.rng().gen(),
                quote_statuses,
                in_progress: None,
            })
        } else {
            Err(CommonErrors::PairNotSupported)
        }
    }

    pub(crate) fn process(mut self, state: &mut RuntimeState) {
        self.in_progress = Some(state.env.now());

        let futures: Vec<_> = self
            .exchange_ids
            .iter()
            .filter_map(|e| state.get_swap_client(*e, self.input_token.clone(), self.output_token.clone()))
            .map(|c| quote_single(c, self.user_id, self.message_id, self.amount, self.output_token.decimals))
            .collect();

        state.enqueue_command(Command::Quote(self));

        ic_cdk::spawn(async {
            futures::future::join_all(futures).await;
        });
    }

    pub fn build_message_text(&self) -> String {
        let mut text = "Quotes:".to_string();
        for (exchange_id, status) in self.quote_statuses.iter().sorted_unstable_by_key(|(_, s)| s) {
            let exchange_name = exchange_id.to_string();
            let status_text = status.to_string();
            text.push_str(&format!("\n{exchange_name}: {status_text}"));
        }
        text
    }

    fn set_status(&mut self, exchange_id: ExchangeId, new_status: QuoteStatus) {
        if let Some(status) = self
            .quote_statuses
            .iter_mut()
            .find(|(e, _)| *e == exchange_id)
            .map(|(_, s)| s)
        {
            *status = new_status;
        }
    }

    fn is_finished(&self) -> bool {
        !self.quote_statuses.iter().any(|(_, s)| matches!(s, QuoteStatus::Pending))
    }
}

async fn quote_single(
    client: Box<dyn SwapClient>,
    user_id: UserId,
    message_id: MessageId,
    amount: u128,
    output_token_decimals: u8,
) {
    let result = client.quote(amount).await;

    mutate_state(|state| {
        if let Some(Command::Quote(command)) = state.data.commands_pending.get_mut(user_id, message_id) {
            let status = match result {
                Ok(amount_out) => QuoteStatus::Success(amount_out, format_crypto_amount(amount_out, output_token_decimals)),
                Err(error) => QuoteStatus::Failed(format!("{error:?}")),
            };
            command.set_status(client.exchange_id(), status);
            let is_finished = command.is_finished();

            let message_text = command.build_message_text();
            state.enqueue_message_edit(user_id, message_id, message_text);

            if is_finished {
                state.data.commands_pending.remove(user_id, message_id);
            }
        }
    })
}
