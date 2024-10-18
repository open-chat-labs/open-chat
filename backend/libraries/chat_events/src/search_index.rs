use search::{Document, Query};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use types::{MessageIndex, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct SearchIndex {
    map: BTreeMap<MessageIndex, (UserId, Document)>,
}

impl SearchIndex {
    pub fn push(&mut self, message_index: MessageIndex, sender: UserId, document: Document) {
        self.map.insert(message_index, (sender, document));
    }

    pub fn remove(&mut self, message_index: MessageIndex) {
        self.map.remove(&message_index);
    }

    pub fn search_messages(
        &self,
        min_visible_message_index: MessageIndex,
        query: Query,
        users: HashSet<UserId>,
    ) -> impl Iterator<Item = MessageIndex> + '_ {
        self.map
            .range(min_visible_message_index..)
            .rev()
            .filter(move |(_, (sender, doc))| {
                (users.is_empty() || users.contains(sender)) && (query.tokens.is_empty() || doc.is_match(&query))
            })
            .map(|(id, _)| *id)
    }
}
