use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Values relevant for the FCM notifications
#[derive(CandidType, Serialize, Deserialize, Clone, Default, Debug)]
pub struct FcmData {
    #[serde(rename = "b")]
    pub body: String,
    #[serde(rename = "i")]
    pub image: Option<String>,
    #[serde(rename = "c")]
    pub chat_id: Option<String>,
    #[serde(rename = "s")]
    pub sender_id: Option<String>,
    #[serde(rename = "n")]
    pub sender_name: String,
    #[serde(rename = "a")]
    pub sender_avatar_id: Option<u128>,
}

impl FcmData {
    pub fn builder() -> FcmDataBuilder {
        FcmDataBuilder::new()
    }

    pub fn as_data(&self) -> HashMap<String, String> {
        let clone = self.clone();
        let mut map = HashMap::new();

        map.insert("body".into(), clone.body);
        map.insert("sender_name".into(), clone.sender_name);

        if let Some(image) = clone.image {
            map.insert("image".into(), image);
        }

        if let Some(chat_id) = clone.chat_id {
            map.insert("chat_id".into(), chat_id);
        }

        if let Some(sender_id) = clone.sender_id {
            map.insert("sender_id".into(), sender_id);
        }

        if let Some(sender_avatar_id) = clone.sender_avatar_id {
            map.insert("sender_avatar_id".into(), sender_avatar_id.to_string());
        }

        map
    }
}

#[derive(Default)]
pub struct FcmDataBuilder {
    body: String,
    image: Option<String>,
    chat_id: Option<String>,
    sender_id: Option<String>,
    sender_name: Option<String>,
    sender_avatar_id: Option<u128>,
}

impl FcmDataBuilder {
    fn new() -> Self {
        Self {
            // TODO i18n?
            body: "You have a notification...".to_string(),
            ..Self::default()
        }
    }

    /// When we know what the body is, and we can take ownership of the value
    pub fn with_body(self, body: String) -> Self {
        Self { body, ..self }
    }

    /// When the wanted value for the body is an Option, but we have an alternative
    /// value we can provide. Borrows the arg values, then creates copies to
    /// reduce boilerplate.
    pub fn with_alt_body(self, body: &Option<String>, alt_body: &str) -> Self {
        Self {
            body: body.clone().unwrap_or(alt_body.to_string()),
            ..self
        }
    }

    /// Image for the notification
    pub fn with_optional_image(self, image: Option<String>) -> Self {
        Self { image, ..self }
    }

    pub fn with_chat_id(self, chat_id: String) -> Self {
        Self {
            chat_id: Some(chat_id),
            ..self
        }
    }

    pub fn with_sender_id(self, sender_id: String) -> Self {
        Self {
            sender_id: Some(sender_id),
            ..self
        }
    }

    /// Set sender name when we know what it will be!
    pub fn with_sender_name(self, sender_name: String) -> Self {
        Self {
            sender_name: Some(sender_name),
            ..self
        }
    }

    /// If wanted title value is optional, also provide alternative title!
    /// Borrows the arg values, then creates copies to reduce boilerplate.
    pub fn with_alt_sender_name(self, sender_name: &Option<String>, alt_sender_name: &str) -> Self {
        Self {
            sender_name: sender_name.clone().or_else(|| Some(alt_sender_name.to_string())),
            ..self
        }
    }

    pub fn with_sender_avatar_id(self, sender_avatar_id: Option<u128>) -> Self {
        Self {
            sender_avatar_id,
            ..self
        }
    }

    // Notifications do not need to have all fields set, so they can remain
    // with default values if not set.
    pub fn build(self) -> FcmData {
        FcmData {
            body: self.body,
            image: self.image,
            chat_id: self.chat_id,
            sender_id: self.sender_id,
            sender_name: self.sender_name.unwrap_or_default(),
            sender_avatar_id: self.sender_avatar_id,
        }
    }
}
