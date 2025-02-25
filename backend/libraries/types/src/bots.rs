use crate::bitflags::{decode_from_bitflags, encode_as_bitflags};
use crate::{
    AccessTokenScope, AudioContent, CanisterId, ChatId, CommunityId, CommunityPermission, FileContent, GiphyContent,
    GroupPermission, GroupRole, ImageContent, MessageContentInitial, MessageId, MessagePermission, PollContent, TextContent,
    TimestampMillis, UserId, VideoContent,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::hash::Hash;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotDefinition {
    pub description: String,
    pub commands: Vec<BotCommandDefinition>,
    pub autonomous_config: Option<AutonomousConfig>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotCommandDefinition {
    pub name: String,
    pub description: Option<String>,
    pub placeholder: Option<String>,
    pub params: Vec<BotCommandParam>,
    pub permissions: BotPermissions,
    pub default_role: Option<GroupRole>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AutonomousConfig {
    pub permissions: BotPermissions,
    pub sync_api_key: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotCommandParam {
    pub name: String,
    pub description: Option<String>,
    pub placeholder: Option<String>,
    pub required: bool,
    pub param_type: BotCommandParamType,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum BotCommandParamType {
    UserParam,
    BooleanParam,
    StringParam(StringParam),
    IntegerParam(IntegerParam),
    #[serde(alias = "NumberParam")]
    DecimalParam(DecimalParam),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct StringParam {
    pub min_length: u16,
    pub max_length: u16,
    #[ts(as = "Vec<BotCommandOptionChoiceString>")]
    pub choices: Vec<BotCommandOptionChoice<String>>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct IntegerParam {
    pub min_value: i128,
    pub max_value: i128,
    #[ts(as = "Vec<BotCommandOptionChoiceI128>")]
    pub choices: Vec<BotCommandOptionChoice<i128>>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DecimalParam {
    pub min_value: f64,
    pub max_value: f64,
    #[ts(as = "Vec<BotCommandOptionChoiceF64>")]
    pub choices: Vec<BotCommandOptionChoice<f64>>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotCommandOptionChoice<T> {
    pub name: String,
    pub value: T,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Default)]
pub struct BotPermissions {
    pub community: HashSet<CommunityPermission>,
    pub chat: HashSet<GroupPermission>,
    pub message: HashSet<MessagePermission>,
}

impl BotPermissions {
    pub fn is_empty(&self) -> bool {
        self.community.is_empty() && self.chat.is_empty() && self.message.is_empty()
    }

    pub fn is_subset(&self, other: &Self) -> bool {
        self.community.is_subset(&other.community) && self.chat.is_subset(&other.chat) && self.message.is_subset(&other.message)
    }

    pub fn intersect(p1: &Self, p2: &Self) -> Self {
        fn intersect<T: Hash + Eq + Clone>(x: &HashSet<T>, y: &HashSet<T>) -> HashSet<T> {
            x.intersection(y).cloned().collect()
        }

        Self {
            community: intersect(&p1.community, &p2.community),
            chat: intersect(&p1.chat, &p2.chat),
            message: intersect(&p1.message, &p2.message),
        }
    }

    pub fn union(p1: &Self, p2: &Self) -> Self {
        fn union<T: Hash + Eq + Clone>(x: &HashSet<T>, y: &HashSet<T>) -> HashSet<T> {
            x.union(y).cloned().collect()
        }

        Self {
            community: union(&p1.community, &p2.community),
            chat: union(&p1.chat, &p2.chat),
            message: union(&p1.message, &p2.message),
        }
    }

    pub fn text_only() -> Self {
        Self::from_message_permission(MessagePermission::Text)
    }

    pub fn from_message_permission(permission: MessagePermission) -> Self {
        Self {
            community: HashSet::new(),
            chat: HashSet::new(),
            message: HashSet::from_iter([permission]),
        }
    }

    pub fn from_community_permission(permission: CommunityPermission) -> Self {
        Self {
            community: HashSet::from_iter([permission]),
            chat: HashSet::new(),
            message: HashSet::new(),
        }
    }

    pub fn chat_owner() -> Self {
        Self {
            community: HashSet::new(),
            chat: HashSet::from_iter(vec![
                GroupPermission::ChangeRoles,
                GroupPermission::UpdateGroup,
                GroupPermission::AddMembers,
                GroupPermission::InviteUsers,
                GroupPermission::RemoveMembers,
                GroupPermission::DeleteMessages,
                GroupPermission::PinMessages,
                GroupPermission::ReactToMessages,
                GroupPermission::MentionAllMembers,
                GroupPermission::StartVideoCall,
            ]),
            message: HashSet::from_iter(vec![
                MessagePermission::Text,
                MessagePermission::Image,
                MessagePermission::Video,
                MessagePermission::Audio,
                MessagePermission::File,
                MessagePermission::Poll,
                MessagePermission::Crypto,
                MessagePermission::Giphy,
                MessagePermission::Prize,
                MessagePermission::P2pSwap,
                MessagePermission::VideoCall,
            ]),
        }
    }
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
    pub endpoint: String,
    pub owner: UserId,
    pub avatar_id: Option<u128>,
    pub commands: Vec<BotCommandDefinition>,
    pub autonomous_config: Option<AutonomousConfig>,
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

slash_command_option_choice!(BotCommandOptionChoiceString, String);
slash_command_option_choice!(BotCommandOptionChoiceF64, f64);
slash_command_option_choice!(BotCommandOptionChoiceI128, i128);

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotGroupDetails {
    pub user_id: UserId,
    pub added_by: UserId,
    pub permissions: BotPermissions,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PublicApiKeyDetails {
    pub bot_id: UserId,
    pub granted_permissions: BotPermissions,
    pub generated_by: UserId,
    pub generated_at: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotGroupConfig {
    pub permissions: BotPermissions,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BotCommand {
    pub name: String,
    pub args: Vec<BotCommandArg>,
    pub initiator: UserId,
    pub meta: Option<BotCommandMeta>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BotCommandMeta {
    pub timezone: String, // IANA timezone e.g. "Europe/London"
    pub language: String, // The language selected in OpenChat e.g. "en"
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BotCommandArg {
    pub name: String,
    pub value: BotCommandArgValue,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum BotCommandArgValue {
    String(String),
    Integer(i64),
    #[serde(alias = "Number")]
    Decimal(f64),
    Boolean(bool),
    User(UserId),
}

#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BotInstallationLocation {
    Community(CommunityId),
    Group(ChatId),
}

impl BotInstallationLocation {
    pub fn canister_id(&self) -> CanisterId {
        match self {
            BotInstallationLocation::Community(c) => (*c).into(),
            BotInstallationLocation::Group(g) => (*g).into(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BotApiKeyToken {
    pub gateway: CanisterId,
    pub bot_id: UserId,
    pub scope: AccessTokenScope,
    pub secret: String,
    pub permissions: EncodedBotPermissions,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotMessageContent {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContent),
    Giphy(GiphyContent),
}

#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum BotInitiator {
    Command(BotCommand),
    ApiKeySecret(String),
    ApiKeyPermissions(BotPermissions),
}

impl BotInitiator {
    pub fn user(&self) -> Option<UserId> {
        match self {
            BotInitiator::Command(bot_command) => Some(bot_command.initiator),
            _ => None,
        }
    }

    pub fn command(&self) -> Option<&BotCommand> {
        match self {
            BotInitiator::Command(bot_command) => Some(bot_command),
            _ => None,
        }
    }
}

impl From<BotMessageContent> for MessageContentInitial {
    fn from(value: BotMessageContent) -> Self {
        match value {
            BotMessageContent::Text(c) => MessageContentInitial::Text(c),
            BotMessageContent::Image(c) => MessageContentInitial::Image(c),
            BotMessageContent::Video(c) => MessageContentInitial::Video(c),
            BotMessageContent::Audio(c) => MessageContentInitial::Audio(c),
            BotMessageContent::File(c) => MessageContentInitial::File(c),
            BotMessageContent::Poll(c) => MessageContentInitial::Poll(c),
            BotMessageContent::Giphy(c) => MessageContentInitial::Giphy(c),
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum AuthToken {
    Jwt(String),
    ApiKey(String),
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ApiKey {
    pub secret: String,
    pub granted_permissions: BotPermissions,
    pub generated_by: UserId,
    pub generated_at: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EncodedBotPermissions {
    #[serde(skip_serializing_if = "Option::is_none")]
    community: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    chat: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<u32>,
}

impl From<BotPermissions> for EncodedBotPermissions {
    fn from(permissions: BotPermissions) -> Self {
        EncodedBotPermissions::from(&permissions)
    }
}

impl From<&BotPermissions> for EncodedBotPermissions {
    fn from(permissions: &BotPermissions) -> Self {
        fn encode<T: Into<u8> + Copy>(field: &HashSet<T>) -> Option<u32> {
            if field.is_empty() {
                None
            } else {
                Some(encode_as_bitflags(field.iter().map(|v| (*v).into())))
            }
        }

        EncodedBotPermissions {
            community: encode(&permissions.community),
            chat: encode(&permissions.chat),
            message: encode(&permissions.message),
        }
    }
}

impl From<EncodedBotPermissions> for BotPermissions {
    fn from(permissions: EncodedBotPermissions) -> Self {
        BotPermissions::from(&permissions)
    }
}

impl From<&EncodedBotPermissions> for BotPermissions {
    fn from(permissions: &EncodedBotPermissions) -> Self {
        fn decode<T: TryFrom<u8> + Copy + Eq + Hash>(field: Option<u32>) -> HashSet<T> {
            field
                .map(decode_from_bitflags)
                .unwrap_or_default()
                .into_iter()
                .filter_map(|v| v.try_into().ok())
                .collect()
        }

        BotPermissions {
            community: decode(permissions.community),
            chat: decode(permissions.chat),
            message: decode(permissions.message),
        }
    }
}

// TODO remove default after release - currently useful for migration
#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub enum BotRegistrationState {
    #[default]
    Public,
    Private(Option<BotInstallationLocation>),
}
