use bots_sdk::{
    agent::Agent,
    api::{InternalError, SuccessResult},
};

use crate::state;

pub async fn joke(agent: Agent) -> Result<SuccessResult, InternalError> {
    let text = state::read(|state| state.get_random_joke());

    // Send the message to OpenChat but don't wait for the response
    let message = agent.send_text_message(text, true);

    Ok(SuccessResult { message: Some(message) })
}
