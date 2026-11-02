use crate::bitflags::{decode_from_bitflags, encode_as_bitflags};
use crate::{
    AudioContent, CanisterId, Chat, ChatEventCategory, ChatEventType, ChatId, ChatPermission, CommunityEventCategory,
    CommunityEventType, CommunityId, CommunityOrGroup, CommunityPermission, FileContent, GiphyContent, GroupRole, ImageContent,
    MessageContentInitial, MessageId, MessagePermission, MiniAppContent, OgPreview, OptionUpdate, PollContent,
    PriceChartContent, TextContent, TimestampMillis, UserId, VideoContent, is_default,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
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
    pub restricted_locations: Option<HashSet<BotInstallationLocationType>>,
    // the apps the bot posts MiniApp cards for, each with its artwork, which a card names
    pub mini_apps: Option<Vec<MiniAppDefinition>>,
}

/// An app a bot hosts, as its definition declares it. A MiniApp card names one, and the card shows
/// the app's image whenever there's no app to show: before the app loads, to someone who can't open
/// it, and once the game's over, with its result.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct MiniAppDefinition {
    // what a card names it by, eg. "chess": see `is_valid_mini_app_name`
    pub name: String,
    // an absolute http(s) URL, or a path relative to the bot's endpoint, eg. "app/chess.svg"
    pub image_url: String,
}

impl MiniAppDefinition {
    pub const MAX_NAME_CHARS: usize = 50;
    pub const MAX_IMAGE_URL_CHARS: usize = 500;
}

/// An app's name is a slug, eg. "chess" or "press_counter": 1 to 50 characters, each a lowercase ASCII
/// letter, a digit, a hyphen or an underscore. A bot's definition declares its apps by these names, and
/// a card names its app by one.
pub fn is_valid_mini_app_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MiniAppDefinition::MAX_NAME_CHARS
        && name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
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
    // Shown only while an earlier param has one of the condition's values; shown always if absent
    pub visible_when: Option<BotCommandParamCondition>,
}

/// When a command's form shows a param, or one of a param's choices: while an earlier param, a
/// `StringParam` with choices, has one of `values`, eg. a game's settings once that game is chosen.
/// A hidden param's arg isn't sent. A client which doesn't read conditions shows every param and
/// choice, as it did before they existed, so a bot still checks the args it's given.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotCommandParamCondition {
    pub param: String,
    pub values: Vec<String>,
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
    pub visible_when: Option<BotCommandParamCondition>,
}

impl BotCommandDefinition {
    /// Checks each condition, on a param or on a choice, names an earlier param, a `StringParam`
    /// with choices, and gives only values among those choices
    pub fn validate_conditions(&self) -> Result<(), String> {
        for (index, param) in self.params.iter().enumerate() {
            let earlier = &self.params[..index];
            if let Some(condition) = &param.visible_when {
                validate_condition(condition, earlier)
                    .map_err(|e| format!("command \"{}\" param \"{}\": {e}", self.name, param.name))?;
            }
            for (choice, condition) in param.param_type.choice_conditions() {
                validate_condition(condition, earlier)
                    .map_err(|e| format!("command \"{}\" param \"{}\" choice \"{choice}\": {e}", self.name, param.name))?;
            }
        }
        Ok(())
    }
}

impl BotCommandParamType {
    /// The name of each choice which has a condition, with its condition
    fn choice_conditions(&self) -> Vec<(&str, &BotCommandParamCondition)> {
        fn conditions<T>(choices: &[BotCommandOptionChoice<T>]) -> Vec<(&str, &BotCommandParamCondition)> {
            choices
                .iter()
                .filter_map(|c| c.visible_when.as_ref().map(|w| (c.name.as_str(), w)))
                .collect()
        }
        match self {
            BotCommandParamType::StringParam(p) => conditions(&p.choices),
            BotCommandParamType::IntegerParam(p) => conditions(&p.choices),
            BotCommandParamType::DecimalParam(p) => conditions(&p.choices),
            _ => Vec::new(),
        }
    }
}

fn validate_condition(condition: &BotCommandParamCondition, earlier: &[BotCommandParam]) -> Result<(), String> {
    let name = &condition.param;
    let Some(param) = earlier.iter().find(|p| &p.name == name) else {
        return Err(format!("its condition names \"{name}\", which isn't an earlier param"));
    };
    let choices = match &param.param_type {
        BotCommandParamType::StringParam(p) if !p.choices.is_empty() => &p.choices,
        _ => {
            return Err(format!(
                "its condition names \"{name}\", which isn't a string param with choices"
            ));
        }
    };
    if condition.values.is_empty() {
        return Err("its condition has no values".to_string());
    }
    if let Some(value) = condition.values.iter().find(|v| !choices.iter().any(|c| &c.value == *v)) {
        return Err(format!("its condition's value \"{value}\" isn't one of \"{name}\"'s choices"));
    }
    Ok(())
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct BotPermissions {
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option::<u32>", optional)]
    community: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option::<u32>", optional)]
    chat: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option::<u32>", optional)]
    message: u32,
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
                MessagePermission::MiniApp,
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

    pub fn permitted_community_event_categories_to_read(&self) -> HashSet<CommunityEventCategory> {
        let mut event_categories = HashSet::new();
        let community_permissions = self.community();

        if community_permissions.contains(&CommunityPermission::ReadMembership) {
            event_categories.insert(CommunityEventCategory::Membership);
        }
        if community_permissions.contains(&CommunityPermission::ReadSummary) {
            event_categories.insert(CommunityEventCategory::Details);
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
    pub og_previews: Option<Vec<OgPreview>>,
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
            pub visible_when: Option<BotCommandParamCondition>,
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
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
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
            // A user's id is not their canister's id, since they are one of many in a MultiUser canister
            BotInstallationLocation::User(u) => UserId::from(*u).canister_id(),
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
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BotInstallationLocationType {
    Community,
    Group,
    User,
}

impl From<BotInstallationLocation> for BotInstallationLocationType {
    fn from(value: BotInstallationLocation) -> Self {
        match value {
            BotInstallationLocation::Community(_) => BotInstallationLocationType::Community,
            BotInstallationLocation::Group(_) => BotInstallationLocationType::Group,
            BotInstallationLocation::User(_) => BotInstallationLocationType::User,
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
    PriceChart(PriceChartContent),
    MiniApp(MiniAppContent),
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
            BotMessageContent::PriceChart(c) => MessageContentInitial::PriceChart(c),
            BotMessageContent::MiniApp(c) => MessageContentInitial::MiniApp(c),
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
pub enum BotCommunityOrGroupContext {
    Command(String),
    Autonomous(CommunityOrGroup),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotRegistrationStatus {
    Public,
    Private(Option<BotInstallationLocation>),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
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
        *self.data_encoding.as_ref().unwrap_or(&BotDataEncoding::MsgPack)
    }

    pub fn command_permissions(&self) -> Option<BotPermissions> {
        let permissions = self
            .commands
            .iter()
            .fold(BotPermissions::default(), |acc, cmd| acc.union(&cmd.permissions));

        if permissions.is_empty() { None } else { Some(permissions) }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum BotDataEncoding {
    #[default]
    MsgPack,
    Json,
    Candid,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotEventPayload {
    pub data: ByteBuf,
    pub signature: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotDefinitionUpdate {
    pub bot_id: UserId,
    pub command_permissions: OptionUpdate<BotPermissions>,
    pub autonomous_permissions: OptionUpdate<BotPermissions>,
    pub default_subscriptions: OptionUpdate<BotSubscriptions>,
}

impl BotDefinitionUpdate {
    pub fn has_updates(&self) -> bool {
        self.command_permissions.has_update()
            || self.autonomous_permissions.has_update()
            || self.default_subscriptions.has_update()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn choice(value: &str, visible_when: Option<BotCommandParamCondition>) -> BotCommandOptionChoice<String> {
        BotCommandOptionChoice {
            name: value.to_string(),
            value: value.to_string(),
            visible_when,
        }
    }

    fn string_param(name: &str, choices: Vec<BotCommandOptionChoice<String>>) -> BotCommandParam {
        BotCommandParam {
            name: name.to_string(),
            description: None,
            placeholder: None,
            required: false,
            param_type: BotCommandParamType::StringParam(StringParam {
                min_length: 1,
                max_length: 10,
                choices,
                multi_line: false,
            }),
            visible_when: None,
        }
    }

    fn when(param: &str, values: &[&str]) -> Option<BotCommandParamCondition> {
        Some(BotCommandParamCondition {
            param: param.to_string(),
            values: values.iter().map(|v| v.to_string()).collect(),
        })
    }

    fn command(params: Vec<BotCommandParam>) -> BotCommandDefinition {
        BotCommandDefinition {
            name: "play".to_string(),
            description: None,
            placeholder: None,
            params,
            permissions: BotPermissions::default(),
            default_role: None,
            direct_messages: None,
        }
    }

    fn game() -> BotCommandParam {
        string_param("game", vec![choice("chess", None), choice("maze", None)])
    }

    #[test]
    fn a_param_without_a_condition_reads_as_it_was_written_before_conditions() {
        // As a param and a choice were stored before they had `visible_when`
        #[derive(Serialize)]
        struct OldChoice {
            name: String,
            value: String,
        }
        #[derive(Serialize)]
        struct OldStringParam {
            min_length: u16,
            max_length: u16,
            choices: Vec<OldChoice>,
            multi_line: bool,
        }
        #[derive(Serialize)]
        enum OldParamType {
            StringParam(OldStringParam),
        }
        #[derive(Serialize)]
        struct OldParam {
            name: String,
            required: bool,
            param_type: OldParamType,
        }
        let old = OldParam {
            name: "game".to_string(),
            required: true,
            param_type: OldParamType::StringParam(OldStringParam {
                min_length: 1,
                max_length: 10,
                choices: vec![OldChoice {
                    name: "Chess".to_string(),
                    value: "chess".to_string(),
                }],
                multi_line: false,
            }),
        };
        let bytes = msgpack::serialize_to_vec(&old).unwrap();
        let param: BotCommandParam = msgpack::deserialize_then_unwrap(&bytes);
        assert!(param.visible_when.is_none());
        let BotCommandParamType::StringParam(string) = param.param_type else {
            panic!("not a string param");
        };
        assert!(string.choices[0].visible_when.is_none());
        // And one without a condition is written as before, without the field
        assert_eq!(msgpack::serialize_to_vec(game()).unwrap(), {
            let game = OldParam {
                name: "game".to_string(),
                required: false,
                param_type: OldParamType::StringParam(OldStringParam {
                    min_length: 1,
                    max_length: 10,
                    choices: ["chess", "maze"]
                        .map(|v| OldChoice {
                            name: v.to_string(),
                            value: v.to_string(),
                        })
                        .into(),
                    multi_line: false,
                }),
            };
            msgpack::serialize_to_vec(game).unwrap()
        });
    }

    #[test]
    fn conditions_on_an_earlier_params_choices_are_valid() {
        let size = BotCommandParam {
            visible_when: when("game", &["maze"]),
            ..string_param("size", vec![choice("small", None), choice("large", None)])
        };
        // A choice's condition, and a chain: "speed" shows for chess, and its "bullet" for chess too
        let speed = string_param(
            "speed",
            vec![choice("rapid", None), choice("bullet", when("game", &["chess"]))],
        );
        let colour = BotCommandParam {
            visible_when: when("speed", &["bullet"]),
            ..string_param("colour", vec![choice("white", None)])
        };
        assert_eq!(command(vec![game(), size, speed, colour]).validate_conditions(), Ok(()));
        assert_eq!(command(vec![game()]).validate_conditions(), Ok(()));
    }

    #[test]
    fn a_condition_must_name_an_earlier_string_param_with_choices() {
        let size = BotCommandParam {
            visible_when: when("game", &["maze"]),
            ..string_param("size", vec![choice("small", None)])
        };
        // Later, not earlier
        let err = command(vec![size.clone(), game()]).validate_conditions().unwrap_err();
        assert!(err.contains("isn't an earlier param"), "{err}");
        // Missing
        let err = command(vec![size.clone()]).validate_conditions().unwrap_err();
        assert!(err.contains("isn't an earlier param"), "{err}");
        // A string param without choices
        let err = command(vec![string_param("game", vec![]), size.clone()])
            .validate_conditions()
            .unwrap_err();
        assert!(err.contains("isn't a string param with choices"), "{err}");
        // Not a string param
        let boolean = BotCommandParam {
            param_type: BotCommandParamType::BooleanParam,
            ..game()
        };
        let err = command(vec![boolean, size]).validate_conditions().unwrap_err();
        assert!(err.contains("isn't a string param with choices"), "{err}");
    }

    #[test]
    fn a_conditions_values_must_be_among_the_params_choices() {
        let size = |values: &[&str]| BotCommandParam {
            visible_when: when("game", values),
            ..string_param("size", vec![choice("small", None)])
        };
        let err = command(vec![game(), size(&["maze", "go"])])
            .validate_conditions()
            .unwrap_err();
        assert_eq!(
            err,
            "command \"play\" param \"size\": its condition's value \"go\" isn't one of \"game\"'s choices"
        );
        let err = command(vec![game(), size(&[])]).validate_conditions().unwrap_err();
        assert!(err.contains("has no values"), "{err}");
        // On a choice too
        let speed = string_param("speed", vec![choice("bullet", when("game", &["go"]))]);
        let err = command(vec![game(), speed]).validate_conditions().unwrap_err();
        assert!(
            err.starts_with("command \"play\" param \"speed\" choice \"bullet\": "),
            "{err}"
        );
    }

    #[test]
    fn mini_app_names_are_1_to_50_lowercase_letters_digits_hyphens_or_underscores() {
        let longest = "x".repeat(MiniAppDefinition::MAX_NAME_CHARS);
        for name in ["chess", "2048", "press_counter", "a-b", longest.as_str()] {
            assert!(is_valid_mini_app_name(name), "{name:?}");
        }
        let too_long = "x".repeat(MiniAppDefinition::MAX_NAME_CHARS + 1);
        for name in ["", "Chess", "my game", "a/b", "é", " chess", too_long.as_str()] {
            assert!(!is_valid_mini_app_name(name), "{name:?}");
        }
    }
}
