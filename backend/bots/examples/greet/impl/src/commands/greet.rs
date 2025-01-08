use bots_sdk::{
    agent::Agent,
    api::{InternalError, SuccessResult},
};

pub async fn greet(agent: Agent) -> Result<SuccessResult, InternalError> {
    let user_id = agent.claims().initiator;
    let text = format!("hello @UserId({user_id})");

    // Send the message to OpenChat but don't wait for the response
    let message = agent.send_text_message(text, true);

    Ok(SuccessResult { message: Some(message) })
}
