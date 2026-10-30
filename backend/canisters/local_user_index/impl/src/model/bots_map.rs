use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    AutonomousConfig, BotCommandDefinition, BotDataEncoding, BotDefinition, BotInstallationLocation, BotRegistrationStatus,
    BotSubscriptions, MiniAppDefinition, UserId,
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
    pub default_subscriptions: Option<BotSubscriptions>,
    pub principal: Principal,
    pub registration_status: BotRegistrationStatus,
    pub data_encoding: BotDataEncoding,
    // the apps the bot posts MiniApp cards for, which a card names one of
    #[serde(default)]
    pub mini_apps: Vec<MiniAppDefinition>,
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

    #[expect(clippy::too_many_arguments)]
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
        data_encoding: BotDataEncoding,
        mini_apps: Vec<MiniAppDefinition>,
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
                data_encoding,
                mini_apps,
            },
        );
        self.principal_to_user_id.insert(user_principal, bot_id);
    }

    pub fn publish(&mut self, bot_id: UserId) {
        self.bots.entry(bot_id).and_modify(|bot| {
            bot.registration_status = BotRegistrationStatus::Public;
        });
    }

    pub fn update(
        &mut self,
        bot_id: UserId,
        owner_id: UserId,
        endpoint: String,
        definition: BotDefinition,
        principal: Option<Principal>,
    ) {
        let Some(bot) = self.bots.get_mut(&bot_id) else {
            return;
        };

        bot.owner_id = owner_id;
        bot.commands = definition.commands;
        bot.endpoint = endpoint;
        bot.autonomous_config = definition.autonomous_config;
        bot.default_subscriptions = definition.default_subscriptions;
        bot.data_encoding = definition.data_encoding.unwrap_or_default();
        bot.mini_apps = definition.mini_apps.unwrap_or_default();

        if let Some(principal) = principal
            && principal != bot.principal
        {
            self.principal_to_user_id.remove(&bot.principal);
            self.principal_to_user_id.insert(principal, bot_id);
            bot.principal = principal;
        }
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
