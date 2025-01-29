use crate::{BotCommand, UserId, UserType};

#[derive(Clone)]
pub enum Caller {
    User(UserId),
    Bot(UserId),
    BotCommand(BotCommandCaller),
    BotApiKey(UserId),
    OCBot(UserId),
}

#[derive(Clone)]
pub enum BotCaller {
    Command(BotCommandCaller),
    ApiKey(UserId),
}

impl BotCaller {
    pub fn bot_id(&self) -> UserId {
        match self {
            BotCaller::Command(bot_caller) => bot_caller.bot,
            BotCaller::ApiKey(user_id) => *user_id,
        }
    }
}

#[derive(Clone)]
pub struct BotCommandCaller {
    pub bot: UserId,
    pub command: BotCommand,
    pub finalised: bool,
}

impl Caller {
    pub fn agent(&self) -> UserId {
        match self {
            Caller::User(user_id) => *user_id,
            Caller::Bot(user_id) => *user_id,
            Caller::BotCommand(bot_caller) => bot_caller.bot,
            Caller::BotApiKey(user_id) => *user_id,
            Caller::OCBot(user_id) => *user_id,
        }
    }

    pub fn initiator(&self) -> Option<UserId> {
        match self {
            Caller::User(user_id) => Some(*user_id),
            Caller::Bot(user_id) => Some(*user_id),
            Caller::BotCommand(bot_caller) => Some(bot_caller.command.initiator),
            Caller::BotApiKey(_) => None,
            Caller::OCBot(user_id) => Some(*user_id),
        }
    }

    pub fn is_bot(&self) -> bool {
        !matches!(self, Caller::User(_))
    }
}

impl From<&Caller> for UserType {
    fn from(caller: &Caller) -> Self {
        match caller {
            Caller::User(_) => UserType::User,
            Caller::Bot(_) => UserType::Bot,
            Caller::BotCommand(_) | Caller::BotApiKey(_) => UserType::BotV2,
            Caller::OCBot(_) => UserType::OcControlledBot,
        }
    }
}
