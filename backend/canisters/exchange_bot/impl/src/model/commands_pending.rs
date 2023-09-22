use crate::commands::Command;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Serialize, Deserialize, Default)]
pub struct CommandsPending {
    commands: VecDeque<Command>,
}

impl CommandsPending {
    pub fn push(&mut self, command: Command) {
        self.commands.push_back(command);
    }

    pub fn pop(&mut self) -> Option<Command> {
        self.commands.pop_front()
    }

    pub fn len(&self) -> usize {
        self.commands.len()
    }

    pub fn is_empty(&self) -> bool {
        self.commands.is_empty()
    }
}
