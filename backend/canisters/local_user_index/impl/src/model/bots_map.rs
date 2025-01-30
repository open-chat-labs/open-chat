use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{AutonomousConfig, BotDefinition, SlashCommandSchema, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct BotsMap {
    bots: HashMap<UserId, Bot>,
    principal_to_user_id: HashMap<Principal, UserId>,
}

#[derive(Serialize, Deserialize)]
pub struct Bot {
    pub user_id: UserId,
    pub name: String,
    pub commands: Vec<SlashCommandSchema>,
    #[serde(default)]
    pub autonomous_config: Option<AutonomousConfig>,
    // TODO: Remove after next release
    #[serde(default = "Principal::anonymous")]
    pub principal: Principal,
}

impl BotsMap {
    pub fn get(&self, user_id: &UserId) -> Option<&Bot> {
        self.bots.get(user_id)
    }

    pub fn get_by_caller(&self, caller: &Principal) -> Option<&Bot> {
        self.principal_to_user_id
            .get(caller)
            .and_then(|user_id| self.bots.get(user_id))
    }

    pub fn add(
        &mut self,
        user_principal: Principal,
        user_id: UserId,
        name: String,
        commands: Vec<SlashCommandSchema>,
        autonomous_config: Option<AutonomousConfig>,
    ) {
        self.bots.insert(
            user_id,
            Bot {
                user_id,
                name,
                commands,
                autonomous_config,
                principal: user_principal,
            },
        );
        self.principal_to_user_id.insert(user_principal, user_id);
    }

    pub fn update(&mut self, user_id: UserId, definition: BotDefinition) {
        self.bots.entry(user_id).and_modify(|bot| {
            bot.commands = definition.commands;
            bot.autonomous_config = definition.autonomous_config;
        });
    }

    pub fn remove(&mut self, user_id: &UserId) -> Option<Bot> {
        let bot = self.bots.remove(user_id)?;
        self.principal_to_user_id.remove(&bot.principal);
        Some(bot)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Bot> {
        self.bots.values()
    }
}
