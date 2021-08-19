use crate::domain::chat::Message;
use itertools::Itertools;
use std::cmp::{max, min};

pub fn get_messages(
    messages: &[Message],
    from_id: u32,
    page_size: u32,
    min_visible_message_id_for_user: u32,
) -> Vec<Message> {
    if messages.is_empty() {
        return Vec::new();
    }

    // The to_id is exclusive
    let to_id = from_id + page_size;

    let earliest_id = messages.first().unwrap().get_id();
    let latest_id = messages.last().unwrap().get_id();

    let from_id = max(from_id, earliest_id);
    let from_id = max(from_id, min_visible_message_id_for_user);

    if from_id > latest_id || from_id >= to_id {
        return Vec::new();
    }

    let from_index = (from_id - earliest_id) as usize;
    let to_index = min((to_id - earliest_id) as usize, messages.len());

    messages[from_index..to_index].to_vec()
}

pub fn get_messages_by_id(
    messages: &[Message],
    ids: Vec<u32>,
    min_visible_message_id_for_user: u32,
) -> Vec<Message> {
    if messages.is_empty() {
        return Vec::new();
    }

    let earliest_id = messages.first().unwrap().get_id();
    let latest_id = messages.last().unwrap().get_id();

    ids.into_iter()
        .sorted()
        .skip_while(|id| *id < min_visible_message_id_for_user)
        .take_while(|id| *id <= latest_id)
        .map(|id| messages[(id - earliest_id) as usize].clone())
        .collect()
}

pub fn get_latest_message_id(messages: &[Message]) -> u32 {
    if messages.is_empty() {
        0
    } else {
        messages.last().unwrap().get_id()
    }
}

pub fn search_messages(messages: &[Message], search_term: &str) -> Vec<Message> {
    messages
        .iter()
        .filter(|&m| m.matches_search(search_term))
        .cloned()
        .collect()
}
