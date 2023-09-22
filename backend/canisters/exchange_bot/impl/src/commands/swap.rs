use crate::commands::common_errors::CommonErrors;
use crate::commands::sub_tasks::check_user_balance::check_user_balance;
use crate::commands::sub_tasks::get_quotes::get_quotes;
use crate::commands::sub_tasks::withdraw::withdraw;
use crate::commands::{Command, CommandParser, CommandSubTaskResult, ParseMessageResult};
use crate::swap_client::SwapClient;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use exchange_bot_canister::ExchangeId;
use lazy_static::lazy_static;
use ledger_utils::{convert_to_subaccount, format_crypto_amount};
use rand::Rng;
use regex_lite::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tracing::{error, trace};
use types::icrc1::{BlockIndex, TransferArg};
use types::{CanisterId, MessageContent, MessageId, TimestampMillis, TimestampNanos, TokenInfo, UserId};

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

format: 'swap $InputToken $OutputToken $Amount'

eg. 'swap ICP CHAT 100'

If $Amount is not provided, the full balance of $InputTokens will be swapped."
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
                return ParseMessageResult::Error(error.build_response_message(&state.data));
            }
        };

        let amount = amount_decimal.map(|a| (a * 10u128.pow(input_token.decimals as u32) as f64) as u128);

        match SwapCommand::build(input_token, output_token, amount, state) {
            Ok(command) => ParseMessageResult::Success(Command::Swap(Box::new(command))),
            Err(error) => ParseMessageResult::Error(error.build_response_message(&state.data)),
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
    pub notify_dex: CommandSubTaskResult<()>,
    pub swap: CommandSubTaskResult<u128>,
    pub withdraw_from_dex: CommandSubTaskResult<u128>,
    pub transfer_to_user: CommandSubTaskResult<BlockIndex>,
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
                        CommandSubTaskResult::NotRequired
                    } else {
                        CommandSubTaskResult::Pending
                    },
                    ..Default::default()
                },
            })
        } else {
            Err(CommonErrors::PairNotSupported)
        }
    }

    pub(crate) fn process(self, state: &mut RuntimeState) {
        let message_id = self.message_id;

        if self.is_finished() {
            trace!(%message_id, "Finished");
            return;
        }

        if self.sub_tasks.check_user_balance.is_pending() {
            trace!(%message_id, "Checking user balance");
            ic_cdk::spawn(self.check_user_balance(state.env.canister_id()));
        } else if let Some(amount_to_dex) = self.amount() {
            match self.sub_tasks.quotes {
                CommandSubTaskResult::Pending => {
                    let clients: Vec<_> = self
                        .exchange_ids
                        .iter()
                        .filter_map(|e| state.get_swap_client(*e, self.input_token.clone(), self.output_token.clone()))
                        .collect();

                    trace!(%message_id, "Getting quotes");
                    ic_cdk::spawn(self.get_quotes(clients, amount_to_dex));
                }
                CommandSubTaskResult::Complete(exchange_id, _) => {
                    if let Some(client) =
                        state.get_swap_client(exchange_id, self.input_token.clone(), self.output_token.clone())
                    {
                        if self.sub_tasks.transfer_to_dex.is_pending() {
                            trace!(%message_id, "Transferring to dex");
                            ic_cdk::spawn(self.transfer_to_dex(client, amount_to_dex));
                        } else if self.sub_tasks.notify_dex.is_pending() {
                            trace!(%message_id, "Notifying to dex");
                            ic_cdk::spawn(self.notify_dex(client, amount_to_dex));
                        } else if self.sub_tasks.swap.is_pending() {
                            trace!(%message_id, "Performing swap");
                            let amount_to_swap = amount_to_dex.saturating_sub(self.input_token.fee);
                            ic_cdk::spawn(self.perform_swap(client, amount_to_swap));
                        } else if self.sub_tasks.withdraw_from_dex.is_pending() {
                            if let Some(&amount_swapped) = self.sub_tasks.swap.value() {
                                let amount_out = amount_swapped.saturating_sub(self.output_token.fee);
                                trace!(%message_id, "Withdrawing from dex");
                                ic_cdk::spawn(self.withdraw_from_dex(client, amount_out));
                            }
                        } else if self.sub_tasks.transfer_to_user.is_pending() {
                            if let Some(&amount_withdrawn_from_dex) = self.sub_tasks.withdraw_from_dex.value() {
                                let amount_to_user = amount_withdrawn_from_dex.saturating_sub(self.output_token.fee);
                                trace!(%message_id, "Transferring funds to user");
                                ic_cdk::spawn(self.transfer_funds_to_user(amount_to_user, state.env.now_nanos()));
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    pub fn build_message_text(&self) -> String {
        let input_token = self.input_token.token.token_symbol();
        let output_token = self.output_token.token.token_symbol();

        let mut messages = vec!["Performing Swap:".to_string()];
        if !matches!(self.sub_tasks.check_user_balance, CommandSubTaskResult::NotRequired) {
            messages.push(format!(
                "Checking {input_token} balance: {}",
                self.sub_tasks.check_user_balance
            ));
        }
        if self.sub_tasks.check_user_balance.is_completed() {
            messages.push(format!("Getting quotes: {}", self.sub_tasks.quotes));
        }
        if let Some(exchange_id) = self.sub_tasks.quotes.value() {
            messages.push(format!(
                "Transferring {input_token} to {exchange_id}: {}",
                self.sub_tasks.transfer_to_dex
            ));
            if self.sub_tasks.transfer_to_dex.is_completed() {
                messages.push(format!("Notifying {exchange_id} of transfer: {}", self.sub_tasks.notify_dex));
            }
            if self.sub_tasks.notify_dex.is_completed() {
                messages.push(format!("Swapping {input_token} for {output_token}: {}", self.sub_tasks.swap));
            }
            if self.sub_tasks.swap.is_completed() {
                messages.push(format!(
                    "Withdrawing {output_token} from {exchange_id}: {}",
                    self.sub_tasks.withdraw_from_dex
                ));
            }
            if self.sub_tasks.withdraw_from_dex.is_completed() {
                messages.push(format!(
                    "Transferring {output_token} to user: {}",
                    self.sub_tasks.transfer_to_user
                ));
            }
        }
        messages.join("\n")
    }

    async fn check_user_balance(mut self, this_canister_id: CanisterId) {
        self.sub_tasks.check_user_balance = check_user_balance(self.user_id, &self.input_token, this_canister_id).await;

        mutate_state(|state| self.on_updated(state));
    }

    async fn get_quotes(mut self, clients: Vec<Box<dyn SwapClient>>, amount: u128) {
        get_quotes(clients, amount, |exchange_id, result| {
            self.set_quote_result(exchange_id, result);
            let message_text = self.build_message_text();
            mutate_state(|state| {
                state.enqueue_message_edit(self.user_id, self.message_id, message_text);
            });
        })
        .await;

        if let Some((exchange_id, CommandSubTaskResult::Complete(..))) = self.quotes.iter().max_by_key(|(_, r)| r.value()) {
            self.sub_tasks.quotes = CommandSubTaskResult::Complete(*exchange_id, Some(format!("{exchange_id} is best")));
        } else {
            self.sub_tasks.quotes = CommandSubTaskResult::Failed("Failed to get any valid quotes".to_string());
        }

        mutate_state(|state| self.on_updated(state));
    }

    async fn transfer_to_dex(mut self, client: Box<dyn SwapClient>, amount: u128) {
        self.sub_tasks.transfer_to_dex = match client.deposit_account().await {
            Ok((ledger, account)) => {
                match icrc1_ledger_canister_c2c_client::icrc1_transfer(
                    ledger,
                    &TransferArg {
                        from_subaccount: Some(convert_to_subaccount(&Principal::from(self.user_id)).0),
                        to: account,
                        fee: None,
                        created_at_time: None,
                        memo: None,
                        amount: amount.into(),
                    },
                )
                .await
                {
                    Ok(Ok(block_index)) => CommandSubTaskResult::Complete(block_index, None),
                    Ok(Err(error)) => CommandSubTaskResult::Failed(format!("{error:?}")),
                    Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
                }
            }
            Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
        };

        mutate_state(|state| self.on_updated(state));
    }

    async fn notify_dex(mut self, client: Box<dyn SwapClient>, amount: u128) {
        self.sub_tasks.notify_dex = match client.deposit(amount).await {
            Ok(_) => CommandSubTaskResult::Complete((), None),
            Err(error) => {
                error!(
                    error = format!("{error:?}").as_str(),
                    message_id = %self.message_id,
                    exchange = %client.exchange_id(),
                    token = self.input_token.token.token_symbol(),
                    amount,
                    "Failed to notify dex, retrying"
                );
                CommandSubTaskResult::Pending
            }
        };

        mutate_state(|state| self.on_updated(state));
    }

    async fn perform_swap(mut self, client: Box<dyn SwapClient>, amount: u128) {
        match client.swap(amount).await {
            Ok(amount_out) => {
                self.sub_tasks.swap = CommandSubTaskResult::Complete(
                    amount_out,
                    Some(format_crypto_amount(amount_out, self.output_token.decimals)),
                );
                mutate_state(|state| self.on_updated(state));
            }
            Err(error) => {
                error!(
                    error = format!("{error:?}").as_str(),
                    message_id = %self.message_id,
                    exchange = %client.exchange_id(),
                    input_token = self.input_token.token.token_symbol(),
                    output_token = self.output_token.token.token_symbol(),
                    amount,
                    "Failed to perform swap, retrying"
                );
                mutate_state(|state| self.enqueue(state));
            }
        }
    }

    async fn withdraw_from_dex(mut self, client: Box<dyn SwapClient>, amount: u128) {
        match client.withdraw(amount).await {
            Ok(amount_out) => {
                self.sub_tasks.withdraw_from_dex = CommandSubTaskResult::Complete(
                    amount_out,
                    Some(format_crypto_amount(amount_out, self.output_token.decimals)),
                );
                mutate_state(|state| self.on_updated(state))
            }
            Err(error) => {
                error!(
                    error = format!("{error:?}").as_str(),
                    message_id = %self.message_id,
                    exchange = %client.exchange_id(),
                    token = self.output_token.token.token_symbol(),
                    amount,
                    "Failed to withdraw from dex, retrying"
                );
                mutate_state(|state| self.enqueue(state));
            }
        };
    }

    async fn transfer_funds_to_user(mut self, amount: u128, now_nanos: TimestampNanos) {
        match withdraw(self.user_id, &self.output_token, amount, true, now_nanos).await {
            CommandSubTaskResult::Failed(error) => {
                error!(
                    error = format!("{error:?}").as_str(),
                    message_id = %self.message_id,
                    token = self.output_token.token.token_symbol(),
                    amount,
                    "Failed to transfer funds to user, retrying"
                );
                mutate_state(|state| self.enqueue(state));
            }
            result => {
                self.sub_tasks.transfer_to_user = result;
                mutate_state(|state| self.on_updated(state))
            }
        };
    }

    fn on_updated(self, state: &mut RuntimeState) {
        let message_text = self.build_message_text();
        state.enqueue_message_edit(self.user_id, self.message_id, message_text);
        self.enqueue(state);
    }

    fn enqueue(self, state: &mut RuntimeState) {
        if !self.is_finished() {
            state.enqueue_command(Command::Swap(Box::new(self)));
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
        self.sub_tasks.any_failed() || !self.sub_tasks.transfer_to_user.is_pending()
    }
}

impl SwapCommandSubTasks {
    fn any_failed(&self) -> bool {
        self.check_user_balance.is_failed()
            || self.quotes.is_failed()
            || self.transfer_to_dex.is_failed()
            || self.notify_dex.is_failed()
            || self.swap.is_failed()
            || self.withdraw_from_dex.is_failed()
            || self.transfer_to_user.is_failed()
    }
}
