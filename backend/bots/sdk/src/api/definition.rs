use serde::Serialize;
use std::collections::HashSet;

#[derive(Serialize)]
pub struct BotDefinition {
    pub description: String,
    pub commands: Vec<SlashCommandSchema>,
}

#[derive(Serialize)]
pub struct SlashCommandSchema {
    pub name: String,
    pub description: Option<String>,
    pub placeholder: Option<String>,
    pub params: Vec<SlashCommandParam>,
    pub permissions: SlashCommandPermissions,
}

#[derive(Serialize)]
pub struct SlashCommandParam {
    pub name: String,
    pub description: Option<String>,
    pub placeholder: Option<String>,
    pub required: bool,
    pub param_type: SlashCommandParamType,
}

#[derive(Serialize)]
pub enum SlashCommandParamType {
    UserParam,
    BooleanParam,
    StringParam(StringParam),
    NumberParam(NumberParam),
}

#[derive(Serialize)]
pub struct StringParam {
    pub min_length: u16,
    pub max_length: u16,
    pub choices: Vec<SlashCommandOptionChoice<String>>,
}

#[derive(Serialize)]
pub struct NumberParam {
    pub min_value: f64,
    pub max_value: f64,
    pub choices: Vec<SlashCommandOptionChoice<f64>>,
}

#[derive(Serialize)]
pub struct SlashCommandOptionChoice<T> {
    pub name: String,
    pub value: T,
}

#[derive(Serialize, Default)]
pub struct SlashCommandPermissions {
    pub community: HashSet<CommunityPermission>,
    pub chat: HashSet<GroupPermission>,
    pub message: HashSet<MessagePermission>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum CommunityPermission {
    ChangeRoles,
    UpdateDetails,
    InviteUsers,
    RemoveMembers,
    CreatePublicChannel,
    CreatePrivateChannel,
    ManageUserGroups,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum GroupPermission {
    ChangeRoles,
    UpdateGroup,
    AddMembers,
    InviteUsers,
    RemoveMembers,
    DeleteMessages,
    PinMessages,
    ReactToMessages,
    MentionAllMembers,
    StartVideoCall,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum MessagePermission {
    Text,
    Image,
    Video,
    Audio,
    File,
    Poll,
    Crypto,
    Giphy,
    Prize,
    P2pSwap,
    VideoCall,
}
