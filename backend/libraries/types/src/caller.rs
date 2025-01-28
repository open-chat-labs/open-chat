use crate::{BotCommand, UserId, UserType};

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
    pub command: BotCommand,
    pub finalised: bool,
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

    pub fn initiator(&self) -> UserId {
        match self {
            Caller::User(user_id) => *user_id,
            Caller::Bot(user_id) => *user_id,
            Caller::BotV2(bot_caller) => bot_caller.command.initiator,
            Caller::OCBot(user_id) => *user_id,
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
            Caller::BotV2(_) => UserType::BotV2,
            Caller::OCBot(_) => UserType::OcControlledBot,
        }
    }
}
