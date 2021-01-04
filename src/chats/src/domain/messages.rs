use std::cmp::{max, min};
use crate::domain::chat::Message;

pub(crate) fn get_messages(messages: &Vec<Message>, from_id: u32, page_size: u32) -> Vec<Message> {
    if messages.is_empty() {
        return Vec::new();
    }

    let earliest_id = messages.first().unwrap().get_id();
    let latest_id = messages.last().unwrap().get_id();

    let from_id = max(from_id, earliest_id);

    if from_id > latest_id {
        return Vec::new();
    }

    let page_size = page_size as usize;
    let from_index = (from_id - earliest_id) as usize;
    let to_index = min(from_index + page_size, messages.len());

    messages[from_index..to_index]
        .iter()
        .map(|m| m.clone())
        .collect()
}

pub(crate) fn get_messages_by_id(messages: &Vec<Message>, ids: Vec<u32>) -> Vec<Message> {
    if messages.is_empty() {
        return Vec::new();
    }

    let earliest_id = messages.first().unwrap().get_id();
    let latest_id = messages.last().unwrap().get_id();

    ids
        .into_iter()
        .filter(|id| *id <= latest_id)
        .map(|id| messages[(id - earliest_id) as usize].clone())
        .collect()
}

pub(crate) fn get_latest_message_id(messages: &Vec<Message>) -> u32 {
    if messages.is_empty() {
        0
    } else {
        messages.last().unwrap().get_id()
    }
}
