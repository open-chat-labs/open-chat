use crate::{ChatEventsList, EventKey};
use search::simple::{Document, Query};
use serde::{Deserialize, Serialize};
use stable_memory_map::{
    ChatEventKeyPrefix, Key, KeyPrefix, SearchSenderKey, SearchSenderKeyPrefix, SearchTokenKey, SearchTokenKeyPrefix,
    StableMemoryMapInner, with_map, with_map_mut,
};
use std::cmp::{max, min};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::ops::Bound;
use tokenizer::{QueryTerm, document_tokens, query_terms};
use types::{EventIndex, MessageIndex, UserId};

mod tokenizer;

// The query terms which are matched by prefix are expanded into at most this many tokens between
// them (each term getting an equal share, but at least `MIN_PREFIX_EXPANSIONS_PER_TERM`, taken in
// byte order so an exact match for the term comes first), so that very short terms can't make a
// search unboundedly expensive
const MAX_PREFIX_EXPANSIONS: usize = 100;
const MIN_PREFIX_EXPANSIONS_PER_TERM: usize = 10;

// A search stops once it has seeked the cursors for individual tokens and senders this many times
// in total, returning the matches found so far, which bounds the cost of a search for which the
// lists being intersected have few messages in common
const MAX_CURSOR_SEEKS: usize = 10_000;

// The number of times a cursor steps forwards before instead seeking directly to its target
const MAX_STEPS_BEFORE_SEEKING: usize = 8;

// An inverted index over the messages in a chat's main events list, stored in the stable memory
// map for small entries (see `SearchTokenKey` and `SearchSenderKey`).
//
// A search finds the messages containing a match for every query term (and, if any users are
// specified, sent by one of those users), most recent first, by intersecting the lists of
// messages matching each term, skipping over the parts of each list which can't contain a match.
#[derive(Serialize, Deserialize, Default)]
pub struct SearchIndex {
    // Messages which haven't yet been added to the index in stable memory. New messages are always
    // added to stable memory, and existing ones are moved across in batches by
    // `migrate_to_stable_memory`. This can be removed once every chat has been migrated.
    //
    // A message with an entry here usually has no entries in stable memory, but it can have if it
    // was imported into a community from a group, since the community indexes the imported
    // messages but also keeps the group's heap entries (see `finalize_group_import`). Migrating a
    // message re-indexes it, which is a no-op for entries which already exist.
    #[serde(rename = "map")]
    on_heap: BTreeMap<MessageIndex, (UserId, Document)>,
}

impl SearchIndex {
    pub fn add(
        &mut self,
        events_prefix: &ChatEventKeyPrefix,
        message_index: MessageIndex,
        sender: UserId,
        document: &Document,
    ) {
        self.on_heap.remove(&message_index);

        let entries = Self::entries(events_prefix, message_index, sender, document);
        insert_entries(entries);
    }

    pub fn remove(
        &mut self,
        events_prefix: &ChatEventKeyPrefix,
        message_index: MessageIndex,
        sender: UserId,
        document: &Document,
    ) {
        self.on_heap.remove(&message_index);
        Self::remove_from_stable_memory(events_prefix, message_index, sender, document);
    }

    pub fn update(
        &mut self,
        events_prefix: &ChatEventKeyPrefix,
        message_index: MessageIndex,
        sender: UserId,
        old: &Document,
        new: &Document,
    ) {
        if self.on_heap.remove(&message_index).is_some() {
            // The message may or may not also be in the index in stable memory (see `on_heap`)
            Self::remove_from_stable_memory(events_prefix, message_index, sender, old);
            self.add(events_prefix, message_index, sender, new);
            return;
        }

        let old_tokens = document_tokens(old);
        let new_tokens = document_tokens(new);
        let token_prefix = SearchTokenKeyPrefix::new_from_events_prefix(events_prefix);
        with_map_mut(|m| {
            for token in old_tokens.difference(&new_tokens) {
                m.remove(token_prefix.create_key_for_token(token, message_index));
            }
            m.insert_many(
                new_tokens
                    .difference(&old_tokens)
                    .map(|token| (token_prefix.create_key_for_token(token, message_index), Vec::new())),
            );
        });
    }

    fn remove_from_stable_memory(
        events_prefix: &ChatEventKeyPrefix,
        message_index: MessageIndex,
        sender: UserId,
        document: &Document,
    ) {
        let token_prefix = SearchTokenKeyPrefix::new_from_events_prefix(events_prefix);
        let sender_prefix = SearchSenderKeyPrefix::new_from_events_prefix(events_prefix);
        with_map_mut(|m| {
            for token in document_tokens(document) {
                m.remove(token_prefix.create_key_for_token(&token, message_index));
            }
            m.remove(sender_prefix.create_key(&(sender, message_index)));
        });
    }

    // The most recent messages (no older than `min_visible_message_index`) matching every term in
    // `search_term` and, if `users` isn't empty, sent by one of `users`
    pub fn search(
        &self,
        events_prefix: &ChatEventKeyPrefix,
        min_visible_message_index: MessageIndex,
        search_term: &str,
        users: &HashSet<UserId>,
        max_results: usize,
    ) -> Vec<MessageIndex> {
        let terms = query_terms(search_term);
        if (terms.is_empty() && users.is_empty()) || max_results == 0 {
            return Vec::new();
        }

        let mut results =
            with_map(|m| search_stable_memory(m, events_prefix, min_visible_message_index, &terms, users, max_results));

        if !self.on_heap.is_empty() {
            let query = Query::new(search_term);
            results.extend(
                self.on_heap
                    .range(min_visible_message_index..)
                    .rev()
                    .filter(|(_, (sender, document))| {
                        (users.is_empty() || users.contains(sender)) && (terms.is_empty() || document.is_match(&query))
                    })
                    .map(|(message_index, _)| *message_index)
                    .take(max_results),
            );
            results.sort_unstable_by(|m1, m2| m2.cmp(m1));
            results.dedup();
            results.truncate(max_results);
        }

        results
    }

    // Adds messages from the heap to the index in stable memory, stopping once at least `max_count`
    // entries have been processed, and returns the number processed. Each message is re-indexed
    // from its current content, since messages which have since expired or been removed may have
    // been left on the heap.
    pub fn migrate_to_stable_memory(
        &mut self,
        events_prefix: &ChatEventKeyPrefix,
        events: &ChatEventsList,
        max_count: usize,
    ) -> usize {
        let mut processed = 0;
        let mut entries = Vec::new();

        while processed < max_count
            && let Some((message_index, _)) = self.on_heap.pop_first()
        {
            let message = events
                .get_event(EventKey::MessageIndex(message_index), EventIndex::default(), None)
                .and_then(|e| e.event.into_message())
                .filter(|m| m.deleted_by.is_none());

            let count_before = entries.len();
            if let Some(message) = message {
                entries.extend(Self::entries(
                    events_prefix,
                    message_index,
                    message.sender,
                    &Document::from(&message.content),
                ));
            }
            processed += max(entries.len() - count_before, 1);
        }

        insert_entries(entries);

        if self.on_heap.is_empty() {
            // Release the map's allocation
            self.on_heap = BTreeMap::new();
        }

        processed
    }

    pub fn on_heap_count(&self) -> usize {
        self.on_heap.len()
    }

    // Recreates the state of a message from before the search index was stored in stable memory
    #[cfg(test)]
    pub(crate) fn move_to_heap(
        &mut self,
        events_prefix: &ChatEventKeyPrefix,
        message_index: MessageIndex,
        sender: UserId,
        document: Document,
    ) {
        self.remove(events_prefix, message_index, sender, &document);
        self.on_heap.insert(message_index, (sender, document));
    }

    pub(crate) fn entries(
        events_prefix: &ChatEventKeyPrefix,
        message_index: MessageIndex,
        sender: UserId,
        document: &Document,
    ) -> Vec<SearchIndexEntry> {
        let token_prefix = SearchTokenKeyPrefix::new_from_events_prefix(events_prefix);
        let sender_prefix = SearchSenderKeyPrefix::new_from_events_prefix(events_prefix);
        document_tokens(document)
            .into_iter()
            .map(|token| SearchIndexEntry::Token(token_prefix.create_key_for_token(&token, message_index)))
            .chain([SearchIndexEntry::Sender(sender_prefix.create_key(&(sender, message_index)))])
            .collect()
    }
}

pub(crate) enum SearchIndexEntry {
    Token(SearchTokenKey),
    Sender(SearchSenderKey),
}

// Sorts the entries into key order, so that each batch of inserts writes as few nodes as possible
pub(crate) fn insert_entries(entries: Vec<SearchIndexEntry>) {
    let mut token_keys = BTreeSet::new();
    let mut sender_keys = BTreeSet::new();
    for entry in entries {
        match entry {
            SearchIndexEntry::Token(key) => token_keys.insert(key),
            SearchIndexEntry::Sender(key) => sender_keys.insert(key),
        };
    }

    with_map_mut(|m| {
        m.insert_many(token_keys.into_iter().map(|k| (k, Vec::new())));
        m.insert_many(sender_keys.into_iter().map(|k| (k, Vec::new())));
    });
}

fn search_stable_memory(
    map: &StableMemoryMapInner,
    events_prefix: &ChatEventKeyPrefix,
    min_visible_message_index: MessageIndex,
    terms: &[QueryTerm],
    users: &HashSet<UserId>,
    max_results: usize,
) -> Vec<MessageIndex> {
    let token_prefix = SearchTokenKeyPrefix::new_from_events_prefix(events_prefix);
    let sender_prefix = SearchSenderKeyPrefix::new_from_events_prefix(events_prefix);
    let mut cursors = Vec::with_capacity(terms.len() + 1);
    let prefix_terms = terms.iter().filter(|t| t.prefix).count();
    let max_expansions_per_term = max(MAX_PREFIX_EXPANSIONS / max(prefix_terms, 1), MIN_PREFIX_EXPANSIONS_PER_TERM);

    for term in terms {
        let tokens = if term.prefix {
            tokens_with_prefix(map, &token_prefix, &term.token, max_expansions_per_term)
        } else {
            vec![term.token.clone()]
        };

        let term_cursors: Vec<Box<dyn Cursor + '_>> = tokens
            .into_iter()
            .map(|token| {
                let prefix = token_prefix.clone();
                Box::new(KeyRangeCursor::new(
                    map,
                    move |message_index| prefix.create_key_for_token(&token, message_index),
                    SearchTokenKey::message_index,
                )) as Box<dyn Cursor>
            })
            .collect();

        cursors.push(UnionCursor::new(term_cursors));
    }

    if !users.is_empty() {
        let user_cursors: Vec<Box<dyn Cursor + '_>> = users
            .iter()
            .map(|user_id| {
                let prefix = sender_prefix.clone();
                let user_id = *user_id;
                Box::new(KeyRangeCursor::new(
                    map,
                    move |message_index| prefix.create_key(&(user_id, message_index)),
                    SearchSenderKey::message_index,
                )) as Box<dyn Cursor>
            })
            .collect();

        cursors.push(UnionCursor::new(user_cursors));
    }

    intersect(cursors, min_visible_message_index, max_results)
}

// The distinct tokens beginning with `term`, found by repeatedly seeking past all of the entries
// for the previous token rather than iterating over them
fn tokens_with_prefix(
    map: &StableMemoryMapInner,
    token_prefix: &SearchTokenKeyPrefix,
    term: &str,
    max_tokens: usize,
) -> Vec<String> {
    let mut tokens = Vec::new();
    // Message indexes are inverted, so the first key for a token is the one for the max index
    let mut start = Bound::Included(token_prefix.create_key_for_token(term, MessageIndex::from(u32::MAX)));

    while tokens.len() < max_tokens {
        let Some((key, _)) = map.range::<SearchTokenKey, _>((start, Bound::Unbounded)).next() else {
            break;
        };
        if !key.matches_prefix(token_prefix) || !key.token().starts_with(term) {
            break;
        }
        let token = key.token().to_string();
        start = Bound::Excluded(token_prefix.create_key_for_token(&token, MessageIndex::from(0)));
        tokens.push(token);
    }

    tokens
}

// Finds the message indexes present in every cursor, most recent first. Each iteration takes the
// oldest of the cursors' heads as the target, since no more recent message can be in every cursor,
// then seeks every cursor to the target. If they all land on it, it is a match.
fn intersect(mut cursors: Vec<UnionCursor>, min_visible_message_index: MessageIndex, max_results: usize) -> Vec<MessageIndex> {
    let mut results = Vec::new();
    if cursors.is_empty() {
        return results;
    }

    let mut seeks = 0;
    'outer: loop {
        seeks += cursors.iter().map(|c| c.cursors.len()).sum::<usize>();
        if seeks > MAX_CURSOR_SEEKS {
            break;
        }

        let mut target = MessageIndex::from(u32::MAX);
        for cursor in cursors.iter() {
            let Some(head) = cursor.head() else {
                break 'outer;
            };
            target = min(target, head);
        }
        if target < min_visible_message_index {
            break;
        }

        let mut matched = true;
        for cursor in cursors.iter_mut() {
            cursor.seek(target);
            match cursor.head() {
                None => break 'outer,
                Some(head) if head != target => matched = false,
                _ => {}
            }
        }

        if matched {
            results.push(target);
            if results.len() >= max_results {
                break;
            }
            for cursor in cursors.iter_mut() {
                cursor.advance();
            }
        }
    }

    results
}

// Iterates over a list of message indexes, most recent first
trait Cursor {
    fn head(&self) -> Option<MessageIndex>;

    fn advance(&mut self);

    // Moves forwards to the first message index which is <= `target`
    fn seek(&mut self, target: MessageIndex);
}

// Iterates over the entries for a single token or sender
struct KeyRangeCursor<'a, K, F> {
    map: &'a StableMemoryMapInner,
    create_key: F,
    extract_message_index: fn(&K) -> MessageIndex,
    iter: Box<dyn Iterator<Item = MessageIndex> + 'a>,
    head: Option<MessageIndex>,
}

impl<'a, K: Key + 'a, F: Fn(MessageIndex) -> K> KeyRangeCursor<'a, K, F> {
    fn new(map: &'a StableMemoryMapInner, create_key: F, extract_message_index: fn(&K) -> MessageIndex) -> Self {
        let mut cursor = KeyRangeCursor {
            map,
            create_key,
            extract_message_index,
            iter: Box::new(std::iter::empty()),
            head: None,
        };
        cursor.reset(MessageIndex::from(u32::MAX));
        cursor
    }

    fn reset(&mut self, from: MessageIndex) {
        let start = (self.create_key)(from);
        let end = (self.create_key)(MessageIndex::from(0));
        let extract_message_index = self.extract_message_index;
        self.iter = Box::new(self.map.range(start..=end).map(move |(k, _)| extract_message_index(&k)));
        self.head = self.iter.next();
    }
}

impl<'a, K: Key + 'a, F: Fn(MessageIndex) -> K> Cursor for KeyRangeCursor<'a, K, F> {
    fn head(&self) -> Option<MessageIndex> {
        self.head
    }

    fn advance(&mut self) {
        self.head = self.iter.next();
    }

    fn seek(&mut self, target: MessageIndex) {
        // The target is often only a few entries ahead, in which case stepping to it is cheaper than
        // starting a new range
        for _ in 0..MAX_STEPS_BEFORE_SEEKING {
            match self.head {
                Some(head) if head > target => self.advance(),
                _ => return,
            }
        }
        if self.head.is_some_and(|head| head > target) {
            self.reset(target);
        }
    }
}

// Iterates over the union of multiple cursors (eg. the entries for each token matching a prefix)
struct UnionCursor<'a> {
    cursors: Vec<Box<dyn Cursor + 'a>>,
}

impl<'a> UnionCursor<'a> {
    fn new(mut cursors: Vec<Box<dyn Cursor + 'a>>) -> Self {
        cursors.retain(|c| c.head().is_some());
        UnionCursor { cursors }
    }

    fn head(&self) -> Option<MessageIndex> {
        self.cursors.iter().filter_map(|c| c.head()).max()
    }

    fn advance(&mut self) {
        if let Some(head) = self.head() {
            for cursor in self.cursors.iter_mut().filter(|c| c.head() == Some(head)) {
                cursor.advance();
            }
            self.cursors.retain(|c| c.head().is_some());
        }
    }

    fn seek(&mut self, target: MessageIndex) {
        for cursor in self.cursors.iter_mut() {
            cursor.seek(target);
        }
        self.cursors.retain(|c| c.head().is_some());
    }
}

#[cfg(test)]
mod tests;
