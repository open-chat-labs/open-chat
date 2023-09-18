use crate::commands::common_errors::CommonErrors;
use crate::commands::{build_error_response, Command, CommandParser, CommandSubTaskResult, ParseMessageResult};
use crate::transfer_to_user::transfer_to_user;
use crate::{mutate_state, RuntimeState};
use lazy_static::lazy_static;
use ledger_utils::{convert_to_subaccount, format_crypto_amount};
use rand::Rng;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use types::icrc1::{Account, BlockIndex};
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
If '$Amount' is not provided, your total balance will be withdrawn"
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
            return build_error_response(error, &state.data);
        };

        let amount = amount_decimal.map(|a| (a * 10u128.pow(token.decimals as u32) as f64) as u128);

        let command = WithdrawCommand::build(token, amount, state);
        ParseMessageResult::Success(Command::Withdraw(command))
    }
}

#[derive(Serialize, Deserialize)]
pub struct WithdrawCommand {
    pub created: TimestampMillis,
    pub user_id: UserId,
    pub token: TokenInfo,
    pub amount_provided: Option<u128>,
    pub message_id: MessageId,
    pub in_progress: Option<TimestampMillis>, // The time it started being processed
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
            in_progress: None,
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

    pub(crate) fn process(mut self, state: &mut RuntimeState) {
        self.in_progress = Some(state.env.now());

        if !self.is_finished() {
            if self.sub_tasks.check_user_balance.is_pending() {
                ic_cdk::spawn(check_user_balance(
                    state.env.canister_id(),
                    self.user_id,
                    self.message_id,
                    self.token.clone(),
                ));
            } else if let Some(amount) = self.amount() {
                ic_cdk::spawn(withdraw(
                    self.user_id,
                    self.message_id,
                    self.token.clone(),
                    amount,
                    state.env.now_nanos(),
                ));
            }
            state.enqueue_command(Command::Withdraw(self));
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
        !matches!(self.sub_tasks.withdraw, CommandSubTaskResult::Pending)
    }
}

async fn check_user_balance(this_canister_id: CanisterId, user_id: UserId, message_id: MessageId, token: TokenInfo) {
    let account = Account {
        owner: this_canister_id,
        subaccount: Some(convert_to_subaccount(&user_id.into()).0),
    };
    let status = match icrc1_ledger_canister_c2c_client::icrc1_balance_of(token.ledger, &account)
        .await
        .map(|a| u128::try_from(a.0).unwrap())
    {
        Ok(amount) => CommandSubTaskResult::Complete(amount, Some(format_crypto_amount(amount, token.decimals))),
        Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
    };
    mutate_state(|state| update_command(user_id, message_id, |c| c.sub_tasks.check_user_balance = status, state));
}

async fn withdraw(user_id: UserId, message_id: MessageId, token: TokenInfo, amount: u128, now_nanos: TimestampNanos) {
    let status = if amount <= token.fee {
        CommandSubTaskResult::NotRequired
    } else {
        match transfer_to_user(user_id, &token, amount, now_nanos).await {
            Ok(Ok(block_index)) => CommandSubTaskResult::Complete(block_index, None),
            Ok(Err(error)) => CommandSubTaskResult::Failed(format!("{error:?}")),
            Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
        }
    };
    mutate_state(|state| update_command(user_id, message_id, |c| c.sub_tasks.withdraw = status, state));
}

fn update_command<F: FnOnce(&mut WithdrawCommand)>(
    user_id: UserId,
    message_id: MessageId,
    update_fn: F,
    state: &mut RuntimeState,
) {
    if let Some(Command::Withdraw(command)) = state.data.commands_pending.get_mut(user_id, message_id) {
        update_fn(command);
        command.in_progress = None;
        let message_text = command.build_message_text();
        state.enqueue_message_edit(user_id, message_id, message_text);
        crate::jobs::process_commands::start_job_if_required(state);
    }
}
