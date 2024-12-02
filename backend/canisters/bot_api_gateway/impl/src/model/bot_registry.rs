use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{SlashCommandSchema, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct BotRegistry {
    bots: HashMap<Principal, Bot>,
}

#[derive(Serialize, Deserialize)]
pub struct Bot {
    pub user_id: UserId,
    pub name: String,
    pub commands: Vec<SlashCommandSchema>,
}

impl BotRegistry {
    pub fn get(&self, caller: &Principal) -> Option<&Bot> {
        self.bots.get(caller)
    }

    pub fn set(&mut self, user_principal: Principal, user_id: UserId, name: String, commands: Vec<SlashCommandSchema>) {
        self.bots.insert(user_principal, Bot { user_id, name, commands });
    }

    pub fn iter(&self) -> impl Iterator<Item = &Bot> {
        self.bots.values()
    }
}
