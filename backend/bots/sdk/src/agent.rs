use candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::{Deserialize, Serialize};

use crate::{
    api::Message,
    env, jwt,
    types::{CanisterId, MessageContent, MessageId, MessageIndex, StringChat, TextContent, UserId},
};

pub struct Agent {
    access_token: String,
    claims: BotCommandClaims,
}

pub enum TokenError {
    Invalid(String),
    Expired,
}

#[derive(Deserialize)]
pub struct BotCommandClaims {
    pub initiator: UserId,
    pub bot: UserId,
    pub chat: StringChat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub command_name: String,
    pub command_args: String,
    pub command_text: String,
    pub bot_api_gateway: CanisterId,
}

impl Agent {
    pub fn build(access_token: String, public_key: &str) -> Result<Self, TokenError> {
        let claims = jwt::verify::<jwt::Claims<BotCommandClaims>>(&access_token, public_key)
            .map_err(|error| TokenError::Invalid(error.to_string()))?;

        if claims.exp_ms() < env::now() {
            return Err(TokenError::Expired);
        }

        Ok(Self {
            access_token,
            claims: claims.into_custom(),
        })
    }

    pub fn claims(&self) -> &BotCommandClaims {
        &self.claims
    }

    pub fn send_text_message(&self, text: String, finalised: bool) -> Message {
        let content = MessageContent::Text(TextContent { text });

        let action = BotAction::SendMessage(BotMessageAction {
            content: content.clone(),
            finalised,
        });

        self.execute_bot_action(action);

        Message {
            id: self.claims.message_id.clone(),
            content,
            finalised,
        }
    }

    fn execute_bot_action(&self, action: BotAction) {
        let args = ActionArgs {
            action,
            jwt: self.access_token.clone(),
        };

        ic_cdk::spawn(execute_bot_action_inner(self.claims.bot_api_gateway, args));

        async fn execute_bot_action_inner(bot_api_gateway: CanisterId, args: ActionArgs) {
            let response: CallResult<(ActionResponse,)> = ic_cdk::call(bot_api_gateway, "execute_bot_command", (&args,)).await;

            let result = match response.map(|r| r.0) {
                Ok(resp) => resp,
                Err((code, message)) => Err(BotApiCallError::C2CError(code as i32, message)),
            };

            if let Some(error) = result.err() {
                ic_cdk::println!("Failed to execute bot action: {:?}", error);
            }
        }
    }
}

#[derive(CandidType, Serialize, Clone)]
struct ActionArgs {
    pub action: BotAction,
    pub jwt: String,
}

type ActionResponse = Result<(), BotApiCallError>;

#[derive(CandidType, Deserialize, Clone, Debug)]
enum BotApiCallError {
    Invalid(String),
    CanisterError(CanisterError),
    C2CError(i32, String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
enum CanisterError {
    NotAuthorized,
    Frozen,
    Other(String),
}

#[derive(CandidType, Serialize, Clone)]
enum BotAction {
    SendMessage(BotMessageAction),
}

#[derive(CandidType, Serialize, Clone)]
struct BotMessageAction {
    pub content: MessageContent,
    pub finalised: bool,
}
