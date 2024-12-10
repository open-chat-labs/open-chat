use search::simple::{Document, Query};
use serde::de::{MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fmt::Formatter;
use types::{MessageIndex, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct SearchIndex {
    #[serde(deserialize_with = "deserialize_weighted_search_map")]
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

struct SearchIndexVisitor;

impl<'de> Visitor<'de> for SearchIndexVisitor {
    type Value = BTreeMap<MessageIndex, (UserId, Document)>;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a map")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut result: BTreeMap<MessageIndex, (UserId, Document)> = BTreeMap::new();
        while let Some((message_index, (user_id, doc))) = map.next_entry()? {
            result.insert(message_index, (user_id, convert_to_simple_doc(doc)));
        }
        Ok(result)
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
enum DocumentCombined {
    Weighted(search::weighted::Document),
    Simple(Document),
}

fn convert_to_simple_doc(doc: DocumentCombined) -> Document {
    match doc {
        DocumentCombined::Weighted(doc) => doc.into(),
        DocumentCombined::Simple(doc) => doc,
    }
}

fn deserialize_weighted_search_map<'de, D: Deserializer<'de>>(
    d: D,
) -> Result<BTreeMap<MessageIndex, (UserId, Document)>, D::Error> {
    d.deserialize_map(SearchIndexVisitor)
}
