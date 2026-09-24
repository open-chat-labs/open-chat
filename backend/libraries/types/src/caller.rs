use crate::{BotCommand, BotInitiator, ChatEventCategory, EventIndex, UserId, UserIdAndPrincipal, UserType};
use std::collections::HashSet;

#[derive(Clone)]
pub enum Caller {
    // The user along with the principal they sign in with
    User(UserIdAndPrincipal),
    Bot(UserId),
    BotV2(BotCaller),
    OCBot(UserId),
    Webhook(UserId),
}

#[derive(Clone)]
pub struct BotCaller {
    pub bot: UserId,
    pub initiator: BotInitiator,
}

impl Caller {
    pub fn agent(&self) -> UserId {
        match self {
            Caller::User(user) => user.user_id,
            Caller::Bot(user_id) => *user_id,
            Caller::BotV2(bot_caller) => bot_caller.bot,
            Caller::OCBot(user_id) => *user_id,
            Caller::Webhook(user_id) => *user_id,
        }
    }

    pub fn initiator(&self) -> Option<UserId> {
        match self {
            Caller::User(user) => Some(user.user_id),
            Caller::Bot(user_id) => Some(*user_id),
            Caller::BotV2(bot_caller) => bot_caller.initiator.user(),
            Caller::OCBot(user_id) => Some(*user_id),
            Caller::Webhook(_) => None,
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
            Caller::Webhook(_) => UserType::Webhook,
        }
    }
}

#[derive(Clone)]
pub enum EventsCaller {
    Unknown,
    User(UserIdAndPrincipal),
    Bot(BotEventsCaller),
    System,
}

#[derive(Clone)]
pub struct BotEventsCaller {
    pub bot: UserId,
    pub min_visible_event_index: EventIndex,
    pub bot_permitted_event_categories: HashSet<ChatEventCategory>,
}

impl EventsCaller {
    pub fn user_id(&self) -> Option<UserId> {
        self.user().map(|u| u.user_id)
    }

    // The user the events are for, along with their principal. A bot's principal is its user id.
    pub fn user(&self) -> Option<UserIdAndPrincipal> {
        match self {
            EventsCaller::User(user) => Some(*user),
            EventsCaller::Bot(bot_caller) => Some(UserIdAndPrincipal::new(bot_caller.bot, bot_caller.bot.as_principal())),
            _ => None,
        }
    }

    pub fn bot_permitted_event_types(&self) -> Option<&HashSet<ChatEventCategory>> {
        match self {
            EventsCaller::Bot(bot_caller) => Some(&bot_caller.bot_permitted_event_categories),
            _ => None,
        }
    }
}
