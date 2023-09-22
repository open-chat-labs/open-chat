use crate::commands::common_errors::CommonErrors;
use crate::commands::sub_tasks::check_user_balance::check_user_balance;
use crate::commands::sub_tasks::withdraw::withdraw;
use crate::commands::{Command, CommandParser, CommandSubTaskResult, ParseMessageResult};
use crate::{mutate_state, RuntimeState};
use lazy_static::lazy_static;
use ledger_utils::format_crypto_amount;
use rand::Rng;
use regex_lite::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use types::icrc1::BlockIndex;
use types::{CanisterId, MessageContent, MessageId, TimestampMillis, TimestampNanos, TokenInfo, UserId};

lazy_static! {
    static ref REGEX: Regex = RegexBuilder::new(r"^withdraw\s+(?<token>\S+)(\s+(?<amount>[\d.,]+))?$")
        .case_insensitive(true)
        .build()
        .unwrap();
}

pub struct WithdrawCommandParser;

impl CommandParser for WithdrawCommandParser {
    fn help_text() -> &'static str {
        "**WITHDRAW**

format: 'withdraw $Token $Amount'
eg. 'withdraw CHAT 50'
If $Amount is not provided, your total balance will be withdrawn"
    }

    fn try_parse(message: &MessageContent, state: &mut RuntimeState) -> ParseMessageResult {
        let text = message.text().unwrap_or_default();

        if !REGEX.is_match(text) {
            return ParseMessageResult::DoesNotMatch;
        }

        let matches = REGEX.captures_iter(text).next().unwrap();
        let token = &matches["token"];
        let amount_decimal = matches.name("amount").map(|m| f64::from_str(m.as_str()).unwrap());

        let token = if let Some(t) = state.data.get_token(token) {
            t
        } else {
            let error = CommonErrors::UnsupportedTokens(vec![token.to_string()]);
            return ParseMessageResult::Error(error.build_response_message(&state.data));
        };

        let amount = amount_decimal.map(|a| (a * 10u128.pow(token.decimals as u32) as f64) as u128);

        let command = WithdrawCommand::build(token, amount, state);
        ParseMessageResult::Success(Command::Withdraw(Box::new(command)))
    }
}

#[derive(Serialize, Deserialize)]
pub struct WithdrawCommand {
    pub created: TimestampMillis,
    pub user_id: UserId,
    pub token: TokenInfo,
    pub amount_provided: Option<u128>,
    pub message_id: MessageId,
    pub sub_tasks: WithdrawCommandSubTasks,
}

#[derive(Serialize, Deserialize)]
pub struct WithdrawCommandSubTasks {
    pub check_user_balance: CommandSubTaskResult<u128>,
    pub withdraw: CommandSubTaskResult<BlockIndex>,
}

impl WithdrawCommand {
    pub(crate) fn build(token: TokenInfo, amount: Option<u128>, state: &mut RuntimeState) -> WithdrawCommand {
        WithdrawCommand {
            created: state.env.now(),
            user_id: state.env.caller().into(),
            token,
            amount_provided: amount,
            message_id: state.env.rng().gen(),
            sub_tasks: WithdrawCommandSubTasks {
                check_user_balance: if amount.is_some() {
                    CommandSubTaskResult::NotRequired
                } else {
                    CommandSubTaskResult::Pending
                },
                withdraw: CommandSubTaskResult::Pending,
            },
        }
    }

    pub(crate) fn process(self, state: &mut RuntimeState) {
        if self.sub_tasks.check_user_balance.is_pending() {
            ic_cdk::spawn(self.check_user_balance(state.env.canister_id()));
        } else if let Some(amount) = self.amount() {
            ic_cdk::spawn(self.withdraw(amount, state.env.now_nanos()));
        }
    }

    pub fn build_message_text(&self) -> String {
        let symbol = self.token.token.token_symbol();

        let mut messages = Vec::new();
        if self.amount_provided.is_none() {
            let status = self.sub_tasks.check_user_balance.to_string();
            messages.push(format!("Checking {symbol} balance: {status}"))
        };
        if let Some(amount) = self.amount() {
            let formatted = format_crypto_amount(amount, self.token.decimals);
            let status = if matches!(self.sub_tasks.withdraw, CommandSubTaskResult::Complete(..)) {
                "complete".to_string()
            } else {
                self.sub_tasks.withdraw.to_string()
            };
            messages.push(format!("Withdrawing {formatted} {symbol}: {status}"));
        };
        messages.join("\n")
    }

    async fn check_user_balance(mut self, this_canister_id: CanisterId) {
        self.sub_tasks.check_user_balance = check_user_balance(self.user_id, &self.token, this_canister_id).await;

        if let Some(amount) = self.amount() {
            if amount <= self.token.fee {
                self.sub_tasks.withdraw = CommandSubTaskResult::NotRequired;
            }
        }

        mutate_state(|state| self.on_updated(state));
    }

    async fn withdraw(mut self, amount: u128, now_nanos: TimestampNanos) {
        self.sub_tasks.withdraw = withdraw(self.user_id, &self.token, amount, false, now_nanos).await;

        mutate_state(|state| self.on_updated(state));
    }

    fn on_updated(self, state: &mut RuntimeState) {
        let is_finished = self.is_finished();

        let message_text = self.build_message_text();
        state.enqueue_message_edit(self.user_id, self.message_id, message_text);

        if !is_finished {
            state.enqueue_command(Command::Withdraw(Box::new(self)));
        }
    }

    fn amount(&self) -> Option<u128> {
        if let Some(a) = self.amount_provided {
            Some(a)
        } else if let CommandSubTaskResult::Complete(a, _) = self.sub_tasks.check_user_balance {
            Some(a.saturating_sub(self.token.fee))
        } else {
            None
        }
    }

    fn is_finished(&self) -> bool {
        !self.sub_tasks.withdraw.is_pending()
    }
}
