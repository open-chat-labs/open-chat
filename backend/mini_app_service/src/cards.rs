// Posting a game's card in its chat, and writing the game's status to it, through the LocalUserIndex's
// `send_mini_app_message` and `update_mini_app`
use async_trait::async_trait;
use ic_agent::Agent;
use local_user_index_canister::{send_mini_app_message, update_mini_app};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, EventIndex, MiniAppContent, MiniAppGame, MiniAppStatusUpdate, UnitResult};

#[derive(Debug)]
pub enum PostError {
    // OpenChat refused the card, which retrying won't change, eg. the bot isn't installed in the chat,
    // or another message has the card's message id. A repeated post of the card itself isn't refused:
    // the chat answers with the card it holds.
    Refused(String),
    // The call failed, eg. the chat's canister was stopped for an upgrade, so it's worth trying again
    Failed(String),
}

#[derive(Debug)]
pub enum WriteError {
    // The game's over: its card was deleted
    CardDeleted,
    // The game's over: its bot was uninstalled from the chat, so only ending it goes through
    BotUninstalled,
    // OpenChat refused the update, which retrying won't change
    Refused(String),
    // The call failed, eg. the chat's canister was stopped for an upgrade, so it's worth trying again
    Failed(String),
}

#[async_trait]
pub trait CardWriter: Send + Sync {
    // Posts a card as the bot whose post token this is
    async fn post(
        &self,
        gateway: CanisterId,
        token: &str,
        content: MiniAppContent,
        block_level_markdown: bool,
        replies_to: Option<EventIndex>,
    ) -> Result<(), PostError>;
    async fn write(&self, gateway: CanisterId, game: &MiniAppGame, update: MiniAppStatusUpdate) -> Result<(), WriteError>;
}

pub struct IcCardWriter {
    agent: Agent,
}

impl IcCardWriter {
    pub fn new(agent: Agent) -> IcCardWriter {
        IcCardWriter { agent }
    }
}

#[async_trait]
impl CardWriter for IcCardWriter {
    async fn post(
        &self,
        gateway: CanisterId,
        token: &str,
        content: MiniAppContent,
        block_level_markdown: bool,
        replies_to: Option<EventIndex>,
    ) -> Result<(), PostError> {
        let args = send_mini_app_message::Args {
            token: token.to_string(),
            content,
            block_level_markdown,
            replies_to,
        };
        match local_user_index_canister_client::send_mini_app_message(&self.agent, &gateway, &args).await {
            Ok(send_mini_app_message::Response::Success(_)) => Ok(()),
            Ok(send_mini_app_message::Response::Error(error)) if error.matches_code(OCErrorCode::C2CError) => {
                Err(PostError::Failed(format!("{error:?}")))
            }
            Ok(send_mini_app_message::Response::Error(error)) => Err(PostError::Refused(
                error.message().map_or_else(|| format!("{error:?}"), str::to_string),
            )),
            Err(error) => Err(PostError::Failed(error.to_string())),
        }
    }

    async fn write(&self, gateway: CanisterId, game: &MiniAppGame, update: MiniAppStatusUpdate) -> Result<(), WriteError> {
        let args = update_mini_app::Args {
            chat: game.chat,
            thread: game.thread,
            message_id: game.message_id,
            update,
        };
        match local_user_index_canister_client::update_mini_app(&self.agent, &gateway, &args).await {
            Ok(UnitResult::Success) => Ok(()),
            Ok(UnitResult::Error(error)) if error.matches_code(OCErrorCode::MessageNotFound) => Err(WriteError::CardDeleted),
            Ok(UnitResult::Error(error)) if error.matches_code(OCErrorCode::BotNotFound) => Err(WriteError::BotUninstalled),
            // The LocalUserIndex couldn't reach the chat
            Ok(UnitResult::Error(error)) if error.matches_code(OCErrorCode::C2CError) => {
                Err(WriteError::Failed(format!("{error:?}")))
            }
            Ok(UnitResult::Error(error)) => Err(WriteError::Refused(format!("{error:?}"))),
            Err(error) => Err(WriteError::Failed(error.to_string())),
        }
    }
}
