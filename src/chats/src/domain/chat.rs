use ic_cdk::export::candid::CandidType;
use ic_types::Principal;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Chat {
    user1: Principal,
    user2: Principal,
    messages: Vec<MessageInternal>
}

impl Chat {
    pub fn new(user1: Principal, user2: Principal) -> Chat {
        Chat {
            user1,
            user2,
            messages: Vec::new()
        }
    }

    pub fn push_message(&mut self, sender: &Principal, text: String, timestamp: u64) {
        let id = match self.messages.last() {
            Some(m) => m.id + 1,
            None => 0
        };

        let message = MessageInternal {
            id,
            timestamp,
            sent_by_user1: sender == &self.user1,
            text
        };

        self.messages.push(message);
    }

    pub fn get_messages(&self, me: &Principal, from_index: usize) -> Vec<Message> {
        if from_index >= self.messages.len() {
            return Vec::new();
        }

        self.messages[from_index..]
            .iter()
            .map(|m| Message::new(m.id, m.timestamp, m.sent_by_user1 == (*me == self.user1), m.text.clone()))
            .collect()
    }

    pub fn get_key(&self) -> (Principal, Principal) {
        (self.user1.clone(), self.user2.clone())
    }
}

#[derive(CandidType)]
pub struct Message {
    id: u64,
    timestamp: u64,
    sent_by_me: bool,
    text: String
}

impl Message {
    pub fn new(id: u64, timestamp: u64, sent_by_me: bool, text: String) -> Message {
        Message {
            id,
            timestamp,
            sent_by_me,
            text
        }
    }
}

#[derive(CandidType, Deserialize)]
struct MessageInternal {
    id: u64,
    timestamp: u64,
    sent_by_user1: bool,
    text: String
}

#[cfg(test)]
#[allow(non_snake_case)]
mod tests {
    use std::time::SystemTime;
    use super::*;

    #[test]
    fn push_message__adds_message_to_list_with_all_fields_set_correctly() {
        let user1 = Principal::from_text("yy53y-szfmc-h2gyu-zlind-wzikf-6zuqh-i4x6u-fvado-rvydl-qxwlz-oqe").unwrap();
        let user2 = Principal::from_text("ups66-6ukpx-mitsu-vhso3-ixjld-5p3m5-fbq6p-bbbma-oyzvm-mjr2w-qae").unwrap();

        let mut chat = Chat::new(user1.clone(), user2.clone());

        for i in 0..10 {
            let text = i.to_string();
            let timestamp = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos() as u64;
            let user = if i < 5 { &user1 } else { &user2 };

            chat.push_message(user, text.clone(), timestamp);

            assert_eq!(chat.messages.len(), i + 1);

            let message = &chat.messages[i];

            assert_eq!(i as u64, message.id);
            assert_eq!(user == &user1, message.sent_by_user1);
            assert_eq!(timestamp, message.timestamp);
            assert_eq!(text, message.text);
        }
    }

    #[test]
    fn get_messages__differing_start_indexes__returns_correct_subset_of_messages() {
        let user1 = Principal::from_text("yy53y-szfmc-h2gyu-zlind-wzikf-6zuqh-i4x6u-fvado-rvydl-qxwlz-oqe").unwrap();
        let user2 = Principal::from_text("ups66-6ukpx-mitsu-vhso3-ixjld-5p3m5-fbq6p-bbbma-oyzvm-mjr2w-qae").unwrap();

        let mut chat = Chat::new(user1.clone(), user2.clone());

        let timestamp = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos() as u64;

        for i in 0..10 {
            let text = i.to_string();
            chat.push_message(&user1, text, timestamp);
        }

        for i in 0..10 {
            let messages = chat.get_messages(&user1, i);

            assert_eq!(10 - i, messages.len());

            assert_eq!(i as u64, messages.first().unwrap().id);
        }
    }

    #[test]
    fn get_messages__start_index_higher_than_last_message_id__returns_empty() {
        let user1 = Principal::from_text("yy53y-szfmc-h2gyu-zlind-wzikf-6zuqh-i4x6u-fvado-rvydl-qxwlz-oqe").unwrap();
        let user2 = Principal::from_text("ups66-6ukpx-mitsu-vhso3-ixjld-5p3m5-fbq6p-bbbma-oyzvm-mjr2w-qae").unwrap();

        let mut chat = Chat::new(user1.clone(), user2.clone());

        let timestamp = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos() as u64;

        for i in 0..10 {
            let text = i.to_string();
            chat.push_message(&user1, text, timestamp);
        }

        for i in 10..20 {
            let messages = chat.get_messages(&user1, i);

            assert_eq!(0, messages.len());
        }
    }
}