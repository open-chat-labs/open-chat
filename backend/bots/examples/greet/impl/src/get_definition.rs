use std::collections::HashSet;

use types::{BotDefinition, MessagePermission, SlashCommandPermissions, SlashCommandSchema};

pub fn get_definition() -> BotDefinition {
    BotDefinition {
        description: "Ths bot provides a single command `greet`".to_string(),
        commands: vec![
            SlashCommandSchema {
                name: "greet".to_string(),
                description: Some("This will greet the caller".to_string()),
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
