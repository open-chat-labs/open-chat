use crate::{CommunityPermission, GroupPermission, MessageContentInitial, MessageId, MessagePermission, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct SlashCommandSchema {
    pub name: String,
    pub description: Option<String>,
    pub params: Vec<SlashCommandParam>,
    pub permissions: SlashCommandPermissions,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct SlashCommandParam {
    pub name: String,
    pub description: Option<String>,
    pub placeholder: Option<String>,
    pub required: bool,
    pub param_type: SlashCommandParamType,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum SlashCommandParamType {
    UserParam,
    BooleanParam,
    StringParam(StringParam),
    NumberParam(NumberParam),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct StringParam {
    pub min_length: u16,
    pub max_length: u16,
    #[ts(as = "Vec<SlashCommandOptionChoiceString>")]
    pub choices: Vec<SlashCommandOptionChoice<String>>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct NumberParam {
    pub min_length: u16,
    pub max_length: u16,
    #[ts(as = "Vec<SlashCommandOptionChoiceU16>")]
    pub choices: Vec<SlashCommandOptionChoice<u16>>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct SlashCommandOptionChoice<T> {
    pub name: String,
    pub value: T,
}

#[ts_export]
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

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotMatch {
    pub id: UserId,
    pub score: u32,
    pub name: String,
    pub description: String,
    pub owner: UserId,
    pub avatar_id: Option<u128>,
    pub banner_id: Option<u128>,
    pub commands: Vec<SlashCommandSchema>,
}

macro_rules! slash_command_option_choice {
    ($name:ident, $value_type:ty) => {
        #[ts_export]
        #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
        struct $name {
            pub name: String,
            pub value: $value_type,
        }
    };
}

slash_command_option_choice!(SlashCommandOptionChoiceString, String);
slash_command_option_choice!(SlashCommandOptionChoiceU16, u16);
