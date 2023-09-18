use crate::commands::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
pub struct CommandsPending {
    commands: Vec<Command>,
}

impl CommandsPending {
    pub fn push(&mut self, command: Command) {
        self.commands.push(command);
    }

    pub fn pop(&mut self) -> Option<Command> {
        self.commands.pop()
    }

    pub fn is_empty(&self) -> bool {
        self.commands.is_empty()
    }
}
