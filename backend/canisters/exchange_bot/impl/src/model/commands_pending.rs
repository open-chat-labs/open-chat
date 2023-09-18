use crate::commands::Command;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use types::{MessageId, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct CommandsPending {
    commands: Vec<Command>,
}

impl CommandsPending {
    pub fn push(&mut self, command: Command) {
        self.commands.push(command);
    }

    pub fn pop_next_for_processing(&mut self) -> Option<Command> {
        let next_index = self
            .commands
            .iter()
            .enumerate()
            .filter(|(_, c)| !c.in_progress())
            .map(|(i, _)| i)
            .next()?;

        Some(self.commands.swap_remove(next_index))
    }

    pub fn get(&self, user_id: UserId, message_id: MessageId) -> Option<&Command> {
        self.commands
            .iter()
            .find(|c| c.user_id() == user_id && c.message_id() == message_id)
    }

    pub fn get_mut(&mut self, user_id: UserId, message_id: MessageId) -> Option<&mut Command> {
        self.commands
            .iter_mut()
            .find(|c| c.user_id() == user_id && c.message_id() == message_id)
    }

    pub fn remove(&mut self, user_id: UserId, message_id: MessageId) -> Option<Command> {
        self.commands
            .iter()
            .find_position(|c| c.user_id() == user_id && c.message_id() == message_id)
            .map(|(i, _)| i)
            .map(|i| self.commands.remove(i))
    }

    pub fn is_empty(&self) -> bool {
        self.commands.is_empty()
    }
}
