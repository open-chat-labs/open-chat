use crate::bitflags::{decode_from_bitflags, encode_as_bitflags};
use crate::{
    AudioContent, CanisterId, Chat, ChatEventCategory, ChatEventType, ChatId, ChatPermission, CommunityEventCategory,
    CommunityEventType, CommunityId, CommunityPermission, FileContent, GiphyContent, GroupRole, ImageContent,
    MessageContentInitial, MessageId, MessagePermission, PollContent, TextContent, TimestampMillis, UserId, VideoContent,
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
    pub default_subscriptions: Option<BotSubscriptions>,
    pub data_encoding: Option<BotDataEncoding>,
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
    pub direct_messages: Option<bool>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AutonomousConfig {
    pub permissions: BotPermissions,
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
    DecimalParam(DecimalParam),
    DateTimeParam(DateTimeParam),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct StringParam {
    pub min_length: u16,
    pub max_length: u16,
    #[ts(as = "Vec<BotCommandOptionChoiceString>")]
    pub choices: Vec<BotCommandOptionChoice<String>>,
    pub multi_line: bool,
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
pub struct DateTimeParam {
    pub future_only: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotCommandOptionChoice<T> {
    pub name: String,
    pub value: T,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct BotPermissions {
    #[serde(skip_serializing_if = "is_zero")]
    #[ts(as = "Option::<u32>", optional)]
    community: u32,
    #[serde(skip_serializing_if = "is_zero")]
    #[ts(as = "Option::<u32>", optional)]
    chat: u32,
    #[serde(skip_serializing_if = "is_zero")]
    #[ts(as = "Option::<u32>", optional)]
    message: u32,
}

fn is_zero(value: &u32) -> bool {
    *value == 0
}

impl BotPermissions {
    pub fn with_community(self, community: &HashSet<CommunityPermission>) -> Self {
        Self {
            community: Self::encode(community),
            ..self
        }
    }

    pub fn with_chat(self, chat: &HashSet<ChatPermission>) -> Self {
        Self {
            chat: Self::encode(chat),
            ..self
        }
    }

    pub fn with_message(self, message: &HashSet<MessagePermission>) -> Self {
        Self {
            message: Self::encode(message),
            ..self
        }
    }

    pub fn community(&self) -> HashSet<CommunityPermission> {
        Self::decode(self.community)
    }

    pub fn chat(&self) -> HashSet<ChatPermission> {
        Self::decode(self.chat)
    }

    pub fn message(&self) -> HashSet<MessagePermission> {
        Self::decode(self.message)
    }

    pub fn is_empty(&self) -> bool {
        self.community == 0 && self.chat == 0 && self.message == 0
    }

    pub fn is_subset(&self, other: &Self) -> bool {
        fn is_subset(x: u32, y: u32) -> bool {
            intersect_bits(x, y) == x
        }

        is_subset(self.community, other.community) && is_subset(self.chat, other.chat) && is_subset(self.message, other.message)
    }

    pub fn intersect(&self, other: &Self) -> Self {
        Self {
            community: intersect_bits(self.community, other.community),
            chat: intersect_bits(self.chat, other.chat),
            message: intersect_bits(self.message, other.message),
        }
    }

    pub fn union(&self, other: &Self) -> Self {
        Self {
            community: union_bits(self.community, other.community),
            chat: union_bits(self.chat, other.chat),
            message: union_bits(self.message, other.message),
        }
    }

    pub fn text_only() -> Self {
        Self::from_message_permission(MessagePermission::Text)
    }

    pub fn from_message_permission(permission: MessagePermission) -> Self {
        Self {
            message: encode_as_bitflags([permission as u8].into_iter()),
            ..Default::default()
        }
    }

    pub fn from_chat_permission(permission: ChatPermission) -> Self {
        Self {
            chat: encode_as_bitflags([permission as u8].into_iter()),
            ..Default::default()
        }
    }

    pub fn from_community_permission(permission: CommunityPermission) -> Self {
        Self {
            community: encode_as_bitflags([permission as u8].into_iter()),
            ..Default::default()
        }
    }

    pub fn chat_owner() -> Self {
        Self::default()
            .with_chat(&HashSet::from_iter([
                ChatPermission::ChangeRoles,
                ChatPermission::UpdateGroup,
                ChatPermission::AddMembers,
                ChatPermission::InviteUsers,
                ChatPermission::RemoveMembers,
                ChatPermission::DeleteMessages,
                ChatPermission::PinMessages,
                ChatPermission::ReactToMessages,
                ChatPermission::MentionAllMembers,
                ChatPermission::StartVideoCall,
                ChatPermission::ReadMessages,
                ChatPermission::ReadMembership,
                ChatPermission::ReadSummary,
            ]))
            .with_message(&HashSet::from_iter([
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
            ]))
    }

    pub fn permitted_chat_event_categories_to_read(&self) -> HashSet<ChatEventCategory> {
        let mut event_categories = HashSet::new();
        let chat_permissions = self.chat();

        if chat_permissions.contains(&ChatPermission::ReadMessages) {
            event_categories.insert(ChatEventCategory::Message);
        }
        if chat_permissions.contains(&ChatPermission::ReadMembership) {
            event_categories.insert(ChatEventCategory::Membership);
        }
        if chat_permissions.contains(&ChatPermission::ReadSummary) {
            event_categories.insert(ChatEventCategory::Details);
        }
        event_categories
    }

    fn encode<T: Into<u8> + Copy>(field: &HashSet<T>) -> u32 {
        encode_as_bitflags(field.iter().map(|v| (*v).into()))
    }

    fn decode<T: TryFrom<u8> + Copy + Eq + Hash>(field: u32) -> HashSet<T> {
        decode_from_bitflags(field)
            .into_iter()
            .filter_map(|v| v.try_into().ok())
            .collect()
    }
}

fn intersect_bits(x: u32, y: u32) -> u32 {
    let mut intersection = [0; 4];
    for (i, (x_byte, y_byte)) in x.to_be_bytes().into_iter().zip(y.to_be_bytes()).enumerate() {
        intersection[i] = x_byte & y_byte;
    }
    u32::from_be_bytes(intersection)
}

fn union_bits(x: u32, y: u32) -> u32 {
    let mut union = [0; 4];
    for (i, (x_byte, y_byte)) in x.to_be_bytes().into_iter().zip(y.to_be_bytes()).enumerate() {
        union[i] = x_byte | y_byte;
    }
    u32::from_be_bytes(union)
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
pub struct InstalledBotDetails {
    pub user_id: UserId,
    pub added_by: UserId,
    pub permissions: BotPermissions,
    pub autonomous_permissions: Option<BotPermissions>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct WebhookDetails {
    pub id: UserId,
    pub name: String,
    pub avatar_id: Option<u128>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BotCommand {
    pub name: String,
    pub args: Vec<BotCommandArg>,
    pub initiator: UserId,
    pub meta: Option<BotCommandMeta>,
}

impl BotCommand {
    pub fn arg(&self, name: &str) -> Option<BotCommandArgValue> {
        self.args.iter().find(|arg| arg.name == name).map(|arg| arg.value.clone())
    }
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
    Decimal(f64),
    Boolean(bool),
    User(UserId),
    DateTime(TimestampMillis),
}

impl BotCommandArgValue {
    pub fn as_string(&self) -> Option<&str> {
        if let Self::String(s) = self { Some(s) } else { None }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BotInstallationLocation {
    Community(CommunityId),
    Group(ChatId),
    User(ChatId),
}

impl BotInstallationLocation {
    pub fn canister_id(&self) -> CanisterId {
        match self {
            BotInstallationLocation::Community(c) => (*c).into(),
            BotInstallationLocation::Group(g) => (*g).into(),
            BotInstallationLocation::User(u) => (*u).into(),
        }
    }
}

impl From<Chat> for BotInstallationLocation {
    fn from(value: Chat) -> Self {
        match value {
            Chat::Channel(community_id, _) => BotInstallationLocation::Community(community_id),
            Chat::Group(g) => BotInstallationLocation::Group(g),
            Chat::Direct(u) => BotInstallationLocation::User(u),
        }
    }
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
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum BotInitiator {
    Command(BotCommand),
    Autonomous,
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
pub enum BotChatContext {
    Command(String),
    Autonomous(Chat),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotRegistrationStatus {
    Public,
    Private(Option<BotInstallationLocation>),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct BotSubscriptions {
    pub community: HashSet<CommunityEventType>,
    pub chat: HashSet<ChatEventType>,
}

impl From<ChatEventCategory> for ChatPermission {
    fn from(value: ChatEventCategory) -> Self {
        match value {
            ChatEventCategory::Message => ChatPermission::ReadMessages,
            ChatEventCategory::Membership => ChatPermission::ReadMembership,
            ChatEventCategory::Details => ChatPermission::ReadSummary,
        }
    }
}

impl From<CommunityEventCategory> for CommunityPermission {
    fn from(value: CommunityEventCategory) -> Self {
        match value {
            CommunityEventCategory::Membership => CommunityPermission::ReadMembership,
            CommunityEventCategory::Details => CommunityPermission::ReadSummary,
        }
    }
}

impl From<&BotSubscriptions> for BotPermissions {
    fn from(value: &BotSubscriptions) -> Self {
        let mut permissions = BotPermissions::default();

        permissions = permissions.with_chat(
            &value
                .chat
                .iter()
                .map(|c| ChatPermission::from(ChatEventCategory::from(*c)))
                .collect(),
        );

        permissions = permissions.with_community(
            &value
                .community
                .iter()
                .map(|c| CommunityPermission::from(CommunityEventCategory::from(*c)))
                .collect(),
        );

        permissions
    }
}

impl BotDefinition {
    pub fn encoding(&self) -> BotDataEncoding {
        *self.data_encoding.as_ref().unwrap_or(&BotDataEncoding::Json)
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum BotDataEncoding {
    #[default]
    Json,
    Candid,
}
