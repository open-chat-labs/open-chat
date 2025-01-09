use oc_bots_sdk::api::{InternalError, SuccessResult};
use oc_bots_sdk_canister::OpenChatClient;

use crate::state;

pub fn joke(agent: OpenChatClient) -> Result<SuccessResult, InternalError> {
    let text = state::read(|state| state.get_random_joke());

    // Send the message to OpenChat but don't wait for the response
    let message = agent.send_text_message(text, true);

    Ok(SuccessResult { message: Some(message) })
}
