// Writing a game's status to its card in the chat, through the LocalUserIndex's `update_mini_app`
use async_trait::async_trait;
use ic_agent::Agent;
use local_user_index_canister::update_mini_app;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, MiniAppGame, MiniAppStatusUpdate, UnitResult};

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
