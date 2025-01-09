use oc_bots_sdk::api::{BotDefinition, MessagePermission, SlashCommandPermissions, SlashCommandSchema};
use std::collections::HashSet;

pub fn get_definition() -> BotDefinition {
    BotDefinition {
        description: "This bot can greet you and tell jokes".to_string(),
        commands: vec![
            SlashCommandSchema {
                name: "greet".to_string(),
                description: Some("This will greet the caller".to_string()),
                placeholder: Some("Please wait".to_string()),
                params: vec![],
                permissions: SlashCommandPermissions {
                    community: HashSet::new(),
                    chat: HashSet::new(),
                    message: HashSet::from_iter([MessagePermission::Text]),
                },
            },
            SlashCommandSchema {
                name: "joke".to_string(),
                description: Some("This will send a random joke".to_string()),
                placeholder: Some("Thinking of a joke...".to_string()),
                params: vec![],
                permissions: SlashCommandPermissions {
                    community: HashSet::new(),
                    chat: HashSet::new(),
                    message: HashSet::from_iter([MessagePermission::Text]),
                },
            },
        ],
    }
}
