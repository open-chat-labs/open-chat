use crate::{BotCommand, BotInitiator, ChatEventType, EventIndex, UserId, UserType};
use std::collections::HashSet;

#[derive(Clone)]
pub enum Caller {
    User(UserId),
    Bot(UserId),
    BotV2(BotCaller),
    OCBot(UserId),
}

#[derive(Clone)]
pub struct BotCaller {
    pub bot: UserId,
    pub initiator: BotInitiator,
}

impl Caller {
    pub fn agent(&self) -> UserId {
        match self {
            Caller::User(user_id) => *user_id,
            Caller::Bot(user_id) => *user_id,
            Caller::BotV2(bot_caller) => bot_caller.bot,
            Caller::OCBot(user_id) => *user_id,
        }
    }

    pub fn initiator(&self) -> Option<UserId> {
        match self {
            Caller::User(user_id) => Some(*user_id),
            Caller::Bot(user_id) => Some(*user_id),
            Caller::BotV2(bot_caller) => bot_caller.initiator.user(),
            Caller::OCBot(user_id) => Some(*user_id),
        }
    }

    pub fn is_bot(&self) -> bool {
        !matches!(self, Caller::User(_))
    }

    pub fn bot_command(&self) -> Option<&BotCommand> {
        match self {
            Caller::BotV2(bot_caller) => bot_caller.initiator.command(),
            _ => None,
        }
    }
}

impl From<&Caller> for UserType {
    fn from(caller: &Caller) -> Self {
        match caller {
            Caller::User(_) => UserType::User,
            Caller::Bot(_) => UserType::Bot,
            Caller::BotV2(_) => UserType::BotV2,
            Caller::OCBot(_) => UserType::OcControlledBot,
        }
    }
}

#[derive(Clone)]
pub enum EventsCaller {
    Unknown,
    User(UserId),
    Bot(BotEventsCaller),
    System,
}

#[derive(Clone)]
pub struct BotEventsCaller {
    pub bot: UserId,
    pub min_visible_event_index: EventIndex,
    pub permitted_event_types: HashSet<ChatEventType>,
}

impl EventsCaller {
    pub fn user_id(&self) -> Option<UserId> {
        match self {
            EventsCaller::User(user_id) => Some(*user_id),
            EventsCaller::Bot(bot_caller) => Some(bot_caller.bot),
            _ => None,
        }
    }

    pub fn permitted_event_types(&self) -> Option<&HashSet<ChatEventType>> {
        match self {
            EventsCaller::Bot(bot_caller) => Some(&bot_caller.permitted_event_types),
            _ => None,
        }
    }
}
