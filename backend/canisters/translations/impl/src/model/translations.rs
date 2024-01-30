use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use translations_canister::proposed::{CandidateTranslation, Record};
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Translations {
    translations: Vec<Translation>,
    records: HashMap<(String, String), Vec<u64>>,
}

impl Translations {
    pub fn propose(&mut self, locale: String, key: String, value: String, user_id: UserId, now: TimestampMillis) -> u64 {
        let id = self.translations.len() as u64;

        self.records
            .entry((locale.clone(), key.clone()))
            .and_modify(|e| {
                e.push(id);

                if let Some(prev) = self
                    .translations
                    .iter_mut()
                    .rev()
                    .find(|t| t.proposed.who == user_id && matches!(t.status, TranslationStatus::Proposed))
                {
                    prev.status = TranslationStatus::Overidden;
                }
            })
            .or_insert(vec![id]);

        self.translations.push(Translation {
            id,
            locale,
            key,
            value,
            proposed: Attribution { who: user_id, when: now },
            status: TranslationStatus::Proposed,
        });

        id
    }

    pub fn approve(&mut self, id: u64, approve: bool, user_id: UserId, now: TimestampMillis) -> ApproveResponse {
        if let Some(translation) = self.translations.get_mut(id as usize) {
            if !matches!(translation.status, TranslationStatus::Proposed) {
                ApproveResponse::NotProposed
            } else {
                let attribution = Attribution { who: user_id, when: now };
                translation.status = if approve {
                    TranslationStatus::Approved(attribution)
                } else {
                    TranslationStatus::Rejected(attribution)
                };
                ApproveResponse::Success
            }
        } else {
            ApproveResponse::NotFound
        }
    }

    pub fn mark_deployed(&mut self, latest_approval: TimestampMillis, now: TimestampMillis) {
        for ids in self.records.values() {
            if let Some(t) = self.find_most_recent_approved_or_deployed(ids) {
                if let TranslationStatus::Approved(attribution) = t.status {
                    if attribution.when <= latest_approval {
                        let index = t.id as usize;
                        if let Some(translation) = self.translations.get_mut(index) {
                            translation.status = TranslationStatus::Deployed(DeployedStatus {
                                approved: attribution,
                                deployed: now,
                            })
                        }
                    }
                }
            }
        }
    }

    pub fn proposed(&self) -> Vec<Record> {
        self.records
            .iter()
            .filter_map(|((locale, key), ids)| {
                let candidates: Vec<_> = ids
                    .iter()
                    .map(|id| &self.translations[(*id) as usize])
                    .filter(|t| matches!(t.status, TranslationStatus::Proposed))
                    .map(|t| CandidateTranslation {
                        id: t.id,
                        value: t.value.clone(),
                        proposed_by: t.proposed.who,
                        proposed_at: t.proposed.when,
                    })
                    .collect();

                if candidates.is_empty() {
                    None
                } else {
                    Some(Record {
                        locale: locale.clone(),
                        key: key.clone(),
                        candidates,
                    })
                }
            })
            .collect()
    }

    pub fn pending_deployment(&self) -> Vec<&Translation> {
        self.records
            .values()
            .filter_map(|ids| match self.find_most_recent_approved_or_deployed(ids) {
                Some(t) if matches!(t.status, TranslationStatus::Approved(_)) => Some(t),
                _ => None,
            })
            .collect()
    }

    fn find_most_recent_approved_or_deployed(&self, ids: &[u64]) -> Option<&Translation> {
        ids.iter()
            .rev()
            .map(|id| &self.translations[(*id) as usize])
            .find(|t| matches!(t.status, TranslationStatus::Approved(_)) || matches!(t.status, TranslationStatus::Deployed(_)))
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
    pub deployed: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct Attribution {
    pub who: UserId,
    pub when: TimestampMillis,
}

pub enum ApproveResponse {
    Success,
    NotProposed,
    NotFound,
}
