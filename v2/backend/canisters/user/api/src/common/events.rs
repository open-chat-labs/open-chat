use candid::CandidType;
use serde::Deserialize;
use shared::types::direct_message::Message;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum EventData {
    Message(Message),
}
