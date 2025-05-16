use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    AutonomousConfig, BotCommandDefinition, BotDefinition, BotInstallationLocation, BotRegistrationStatus, BotSubscriptions,
    UserId,
};

#[derive(Serialize, Deserialize, Default)]
pub struct BotsMap {
    bots: HashMap<UserId, Bot>,
    principal_to_user_id: HashMap<Principal, UserId>,
}

#[derive(Serialize, Deserialize)]
pub struct Bot {
    pub bot_id: UserId,
    pub owner_id: UserId,
    pub name: String,
    pub commands: Vec<BotCommandDefinition>,
    pub endpoint: String,
    pub autonomous_config: Option<AutonomousConfig>,
    #[serde(default)]
    pub default_subscriptions: Option<BotSubscriptions>,
    pub principal: Principal,
    pub registration_status: BotRegistrationStatus,
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

    pub fn exists(&self, bot_id: &UserId) -> bool {
        self.bots.contains_key(bot_id)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn add(
        &mut self,
        user_principal: Principal,
        bot_id: UserId,
        owner_id: UserId,
        name: String,
        commands: Vec<BotCommandDefinition>,
        endpoint: String,
        autonomous_config: Option<AutonomousConfig>,
        default_subscriptions: Option<BotSubscriptions>,
        permitted_install_location: Option<BotInstallationLocation>,
    ) {
        self.bots.insert(
            bot_id,
            Bot {
                bot_id,
                owner_id,
                name,
                commands,
                endpoint,
                autonomous_config,
                default_subscriptions,
                principal: user_principal,
                registration_status: BotRegistrationStatus::Private(permitted_install_location),
            },
        );
        self.principal_to_user_id.insert(user_principal, bot_id);
    }

    pub fn publish(&mut self, bot_id: UserId) {
        self.bots.entry(bot_id).and_modify(|bot| {
            bot.registration_status = BotRegistrationStatus::Public;
        });
    }

    pub fn update(&mut self, bot_id: UserId, owner_id: UserId, endpoint: String, definition: BotDefinition) {
        self.bots.entry(bot_id).and_modify(|bot| {
            bot.owner_id = owner_id;
            bot.commands = definition.commands;
            bot.endpoint = endpoint;
            bot.autonomous_config = definition.autonomous_config;
        });
    }

    pub fn remove(&mut self, bot_id: &UserId) -> Option<Bot> {
        let bot = self.bots.remove(bot_id)?;
        self.principal_to_user_id.remove(&bot.principal);
        Some(bot)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Bot> {
        self.bots.values()
    }
}
