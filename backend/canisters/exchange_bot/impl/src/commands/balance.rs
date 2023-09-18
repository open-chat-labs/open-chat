use crate::commands::common_errors::CommonErrors;
use crate::commands::{build_error_response, Command, CommandParser, CommandSubTaskResult, ParseMessageResult};
use crate::{mutate_state, RuntimeState};
use lazy_static::lazy_static;
use ledger_utils::{convert_to_subaccount, format_crypto_amount};
use rand::Rng;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use types::icrc1::Account;
use types::{CanisterId, MessageContent, MessageId, TimestampMillis, TokenInfo, UserId};

lazy_static! {
    static ref REGEX: Regex = RegexBuilder::new(r"^balance\s+(?<token>\S+)$")
        .case_insensitive(true)
        .build()
        .unwrap();
}

pub struct BalanceCommandParser;

impl CommandParser for BalanceCommandParser {
    fn help_text() -> &'static str {
        "**BALANCE**

format: 'balance $Token'
eg. 'balance CHAT'"
    }

    fn try_parse(message: &MessageContent, state: &mut RuntimeState) -> ParseMessageResult {
        let text = message.text().unwrap_or_default();

        if !REGEX.is_match(text) {
            return ParseMessageResult::DoesNotMatch;
        }

        let matches = REGEX.captures_iter(text).next().unwrap();
        let token = &matches["token"];

        let token = if let Some(t) = state.data.get_token(token) {
            t
        } else {
            let error = CommonErrors::UnsupportedTokens(vec![token.to_string()]);
            return build_error_response(error, &state.data);
        };

        let command = BalanceCommand::build(token, state);
        ParseMessageResult::Success(Command::Balance(command))
    }
}

#[derive(Serialize, Deserialize)]
pub struct BalanceCommand {
    pub created: TimestampMillis,
    pub user_id: UserId,
    pub token: TokenInfo,
    pub message_id: MessageId,
    pub result: CommandSubTaskResult<u128>,
}

impl BalanceCommand {
    pub(crate) fn build(token: TokenInfo, state: &mut RuntimeState) -> BalanceCommand {
        BalanceCommand {
            created: state.env.now(),
            user_id: state.env.caller().into(),
            token,
            message_id: state.env.rng().gen(),
            result: CommandSubTaskResult::Pending,
        }
    }

    pub(crate) fn process(self, state: &mut RuntimeState) {
        ic_cdk::spawn(self.check_user_balance(state.env.canister_id()));
    }

    pub fn build_message_text(&self) -> String {
        let symbol = self.token.token.token_symbol();
        let status = self.result.to_string();
        format!("Checking {symbol} balance: {status}")
    }

    async fn check_user_balance(mut self, this_canister_id: CanisterId) {
        self.result = check_user_balance(self.user_id, &self.token, this_canister_id).await;

        mutate_state(|state| {
            let message_text = self.build_message_text();
            state.enqueue_message_edit(self.user_id, self.message_id, message_text);
        });
    }
}

pub(crate) async fn check_user_balance(
    user_id: UserId,
    token: &TokenInfo,
    this_canister_id: CanisterId,
) -> CommandSubTaskResult<u128> {
    let account = Account {
        owner: this_canister_id,
        subaccount: Some(convert_to_subaccount(&user_id.into()).0),
    };

    match icrc1_ledger_canister_c2c_client::icrc1_balance_of(token.ledger, &account)
        .await
        .map(|a| u128::try_from(a.0).unwrap())
    {
        Ok(amount) => CommandSubTaskResult::Complete(amount, Some(format_crypto_amount(amount, token.decimals))),
        Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
    }
}
