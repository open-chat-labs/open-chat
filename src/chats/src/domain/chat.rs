use ic_cdk::export::candid::CandidType;
use ic_types::Principal;
use highway::{HighwayHasher, HighwayHash};
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Chat {
    id: ChatId,
    user1: Principal,
    user2: Principal,
    messages: Vec<MessageInternal>
}

impl Chat {
    pub fn get_id(&self) -> ChatId {
        self.id
    }

    pub fn new(id: ChatId, sender: Principal, recipient: Principal, text: String, timestamp: u64) -> Chat {

        let message = MessageInternal {
            id: 0,
            timestamp,
            sent_by_user1: true,
            text
        };

        Chat {
            id,
            user1: sender,
            user2: recipient,
            messages: vec![message]
        }
    }

    pub fn involves_user(&self, user: &Principal) -> bool {
        self.user1 == *user || self.user2 == *user
    }

    pub fn push_message(&mut self, sender: &Principal, text: String, timestamp: u64) -> u64 {
        let id = self.messages.last().unwrap().id + 1;

        let message = MessageInternal {
            id,
            timestamp,
            sent_by_user1: sender == &self.user1,
            text
        };

        self.messages.push(message);

        id
    }

    pub fn get_messages(&self, me: &Principal, from_index: usize) -> Vec<Message> {
        if from_index >= self.messages.len() {
            return Vec::new();
        }

        self.messages[from_index..]
            .iter()
            .map(|m| Message::new(
                m.id, 
                m.timestamp, 
                m.sent_by_user1 == (*me == self.user1), 
                m.text.clone()))
            .collect()
    }

    pub fn to_summary(&self, me: &Principal) -> ChatSummary {
        let message = self.messages.last().unwrap();

        ChatSummary {
            id: self.id,
            them: if self.user1 == *me { self.user2.clone() } else { self.user1.clone() },
            most_recent: Message::new(
                message.id, 
                message.timestamp,
                message.sent_by_user1 == (*me == self.user1), 
                message.text.clone())
        }
    }
}

/// TODO: We would preferably use a Uuid or u128 but these haven't yet got a CandidType implementation
#[derive(CandidType, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatId(u64);

impl ChatId {
    pub fn new(user1: &Principal, user2: &Principal) -> ChatId {
        let mut hasher = HighwayHasher::default();

        if user1 < user2 {
            hasher.append(user1.as_slice());
            hasher.append(user2.as_slice());    
        } else {
            hasher.append(user2.as_slice());
            hasher.append(user1.as_slice());    
        }

        ChatId(hasher.finalize64())
    }
}

#[derive(CandidType)]
pub struct ChatSummary {
    id: ChatId,
    them: Principal,
    most_recent: Message,
}

impl ChatSummary {
    pub fn get_most_recent(&self) -> &Message {
        &self.most_recent
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

    pub fn get_timestamp(&self) -> u64 {
        self.timestamp
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

        let mut chat = Chat::new(
            ChatId::new(&user1, &user2),
            user1.clone(), 
            user2.clone());

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

        let mut chat = Chat::new(
            ChatId::new(&user1, &user2),
            user1.clone(), 
            user2.clone());

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

        let mut chat = Chat::new(
            ChatId::new(&user1, &user2),
            user1.clone(), 
            user2.clone());

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