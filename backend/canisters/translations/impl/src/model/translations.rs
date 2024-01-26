use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use translations_canister::proposed::Record;
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Translations {
    translations: Vec<Translation>,
    records: HashMap<(String, String), Vec<u64>>,
}

impl Translations {
    pub fn pending(&self) -> Vec<Record> {
        self.records
            .iter()
            .filter_map(|((locale, key), ids)| self.candidates(locale, key, ids))
            .collect()
    }

    fn candidates(&self, locale: &str, key: &str, ids: &Vec<u64>) -> Option<Record> {
        let matching_translations = ids.map(|id| self.translations[(**id) as usize])

        // Record {
        //     locale: locale.to_string(),
        //     key: key.to_string(),
        //     candidates: self.candidates(ids),
        // }
        //ids.filter(|index| self.translations[(**index) as usize])
        None
    }
}

#[derive(Serialize, Deserialize)]
pub struct Translation {
    pub id: u64,
    pub locale: String,
    pub key: String,
    pub value: String,
    pub proposed: Attribution,
    pub status: TranslationStatus,
}

#[derive(Serialize, Deserialize)]
pub enum TranslationStatus {
    Proposed,
    Overidden,
    Approved(Attribution),
    Rejected(Attribution),
    Deployed(DeployedStatus),
}

#[derive(Serialize, Deserialize)]
pub struct DeployedStatus {
    pub approved: Attribution,
    pub deployed: Attribution,
}

#[derive(Serialize, Deserialize)]
pub struct Attribution {
    pub who: UserId,
    pub when: TimestampMillis,
}
