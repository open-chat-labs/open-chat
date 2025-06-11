use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Values relevant for the FCM notifications
#[derive(CandidType, Serialize, Deserialize, Clone, Default)]
pub struct FcmData {
    #[serde(rename = "t")]
    pub title: String,
    #[serde(rename = "b")]
    pub body: String,
    #[serde(rename = "i")]
    pub image: Option<String>,
    #[serde(rename = "d")]
    pub data: Option<HashMap<String, String>>,
}

impl FcmData {
    pub fn builder() -> FcmDataBuilder {
        FcmDataBuilder::new()
    }
}

#[derive(Default)]
pub struct FcmDataBuilder {
    title: String,
    body: String,
    image: Option<String>,
    data: HashMap<String, String>,
}

impl FcmDataBuilder {
    fn new() -> Self {
        Self {
            title: "OpenChat".to_string(),
            body: "You have a notification...".to_string(),
            ..Self::default()
        }
    }

    /// Set title when we know what it will be!
    pub fn with_title(self, title: String) -> Self {
        Self { title, ..self }
    }

    /// If wanted title value is optional, also provide alternative title!
    /// Borrows the arg values, then creates copies to reduce boilerplate.
    pub fn with_alt_title(self, title: &Option<String>, alt_title: &str) -> Self {
        Self {
            title: title.clone().unwrap_or(alt_title.to_string()),
            ..self
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

    /// Additional notification data in key & value format!
    pub fn with_data(self, key: String, value: String) -> Self {
        let mut data = self.data;
        data.insert(key, value);
        Self { data, ..self }
    }

    pub fn build(self) -> FcmData {
        FcmData {
            title: self.title,
            body: self.body,
            image: self.image,
            data: if self.data.is_empty() { None } else { Some(self.data) },
        }
    }
}
