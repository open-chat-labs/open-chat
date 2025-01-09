use oc_bots_sdk::api::{InternalError, SuccessResult};
use oc_bots_sdk_canister::OpenChatClient;

pub fn greet(agent: OpenChatClient) -> Result<SuccessResult, InternalError> {
    let user_id = agent.claims().initiator;
    let text = format!("hello @UserId({user_id})");

    // Send the message to OpenChat but don't wait for the response
    let message = agent.send_text_message(text, true);

    Ok(SuccessResult { message: Some(message) })
}
