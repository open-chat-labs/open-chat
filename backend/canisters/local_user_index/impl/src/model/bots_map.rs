use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    AutonomousConfig, BotCommandDefinition, BotDataEncoding, BotDefinition, BotInstallationLocation, BotRegistrationStatus,
    BotSubscriptions, UserId,
};
use utils::migrated_user_ids::MigratedUserIds;

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
            bot.default_subscriptions = definition.default_subscriptions;
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

    // One-off: replaces the ids users had before being migrated to a MultiUser canister with their
    // latest ids, in each bot's owner and the direct chats it may only be installed in. The UserIndex
    // replaced its own copies as each user was migrated, but never told the LocalUserIndexes. Returns
    // how many owners and how many locations were replaced.
    pub fn replace_old_user_ids(&mut self, migrated_user_ids: &MigratedUserIds) -> (usize, usize) {
        let mut owners_replaced = 0;
        let mut locations_replaced = 0;
        for bot in self.bots.values_mut() {
            let owner_id = migrated_user_ids.latest(bot.owner_id);
            if owner_id != bot.owner_id {
                bot.owner_id = owner_id;
                owners_replaced += 1;
            }
            if let BotRegistrationStatus::Private(Some(BotInstallationLocation::User(chat_id))) = &mut bot.registration_status {
                let user_id = migrated_user_ids.latest((*chat_id).into());
                if user_id != (*chat_id).into() {
                    *chat_id = user_id.into();
                    locations_replaced += 1;
                }
            }
        }
        (owners_replaced, locations_replaced)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn add_bot(
        bots: &mut BotsMap,
        bot_id: UserId,
        owner_id: UserId,
        permitted_install_location: Option<BotInstallationLocation>,
    ) {
        bots.add(
            Principal::from_slice(&[100, bot_id.as_slice()[0]]),
            bot_id,
            owner_id,
            "bot".to_string(),
            Vec::new(),
            "https://my.bot.xyz/".to_string(),
            None,
            None,
            permitted_install_location,
            BotDataEncoding::default(),
        );
    }

    #[test]
    fn old_user_ids_are_replaced_with_the_latest() {
        let old_owner = user_id(1);
        let latest_owner = user_id(2);
        let old_peer = user_id(3);
        let latest_peer = user_id(4);
        let unmigrated = user_id(5);
        let group = BotInstallationLocation::Group(Principal::from_slice(&[6]).into());

        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(old_owner, latest_owner);
        migrated_user_ids.insert(old_peer, latest_peer);

        let mut bots = BotsMap::default();
        add_bot(
            &mut bots,
            user_id(11),
            old_owner,
            Some(BotInstallationLocation::User(old_peer.into())),
        );
        add_bot(&mut bots, user_id(12), old_owner, Some(group));
        add_bot(
            &mut bots,
            user_id(13),
            unmigrated,
            Some(BotInstallationLocation::User(unmigrated.into())),
        );
        add_bot(&mut bots, user_id(14), latest_owner, None);
        bots.publish(user_id(14));

        assert_eq!(bots.replace_old_user_ids(&migrated_user_ids), (2, 1));

        let owner_and_status = |bot_id| {
            let bot = bots.get(&user_id(bot_id)).unwrap();
            (bot.owner_id, bot.registration_status.clone())
        };
        assert!(matches!(
            owner_and_status(11),
            (owner, BotRegistrationStatus::Private(Some(BotInstallationLocation::User(chat_id))))
                if owner == latest_owner && UserId::from(chat_id) == latest_peer
        ));
        assert!(matches!(
            owner_and_status(12),
            (owner, BotRegistrationStatus::Private(Some(location))) if owner == latest_owner && location == group
        ));
        // Ids which haven't been migrated, eg. those of bots, are left as they are
        assert!(matches!(
            owner_and_status(13),
            (owner, BotRegistrationStatus::Private(Some(BotInstallationLocation::User(chat_id))))
                if owner == unmigrated && UserId::from(chat_id) == unmigrated
        ));
        assert!(matches!(owner_and_status(14), (owner, BotRegistrationStatus::Public) if owner == latest_owner));

        // Every old id has now been replaced, so running it again changes nothing
        assert_eq!(bots.replace_old_user_ids(&migrated_user_ids), (0, 0));
    }
}
