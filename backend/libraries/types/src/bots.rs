use crate::{CommunityPermission, GroupPermission, MessageContentInitial, MessageId, MessagePermission};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use ts_export::ts_export;

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct SlashCommandSchema {
    pub name: String,
    pub description: Option<String>,
    pub params: Vec<SlashCommandParam>,
    pub permissions: SlashCommandPermissions,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct SlashCommandParam {
    pub name: String,
    pub description: Option<String>,
    pub placeholder: Option<String>,
    pub required: bool,
    pub param_type: SlashCommandParamType,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum SlashCommandParamType {
    UserParam,
    BooleanParam,
    StringParam(StringParam),
    NumberParam(NumberParam),
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct StringParam {
    pub min_length: u16,
    pub max_length: u16,
    pub choices: HashMap<String, String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct NumberParam {
    pub min_length: u16,
    pub max_length: u16,
    pub choices: HashMap<String, u16>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct SlashCommandPermissions {
    pub community: HashSet<CommunityPermission>,
    pub chat: HashSet<GroupPermission>,
    pub message: HashSet<MessagePermission>,
    pub thread: HashSet<MessagePermission>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotMessage {
    pub thread_root_message_id: Option<MessageId>,
    pub content: MessageContentInitial,
    pub message_id: Option<MessageId>,
    pub block_level_markdown: Option<bool>,
}
