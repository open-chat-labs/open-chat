use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use translations_canister::proposed::{CandidateTranslation, Record};
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Translations {
    translations: Vec<Translation>,
    records: HashMap<(String, String), Vec<usize>>,
}

impl Translations {
    pub fn propose(
        &mut self,
        locale: String,
        key: String,
        value: String,
        user_id: UserId,
        now: TimestampMillis,
    ) -> Option<u64> {
        let tuple = (locale.clone(), key.clone());

        // Loop backwards through translations until we reach the most recently deployed.
        // If any of these translations matches the proposed value then don't add the translation.
        if let Some(ids) = self.records.get(&tuple) {
            for index in ids.iter().rev() {
                if let Some(translation) = self.translations.get(*index) {
                    if translation.value == value {
                        return None;
                    }

                    if matches!(translation.status, TranslationStatus::Deployed(_)) {
                        break;
                    }
                }
            }
        }

        let new_index = self.translations.len();

        self.records
            .entry(tuple.clone())
            .and_modify(|e| {
                e.push(new_index);

                if let Some(prev) = self
                    .translations
                    .iter_mut()
                    .rev()
                    .find(|t| t.proposed.who == user_id && matches!(t.status, TranslationStatus::Proposed))
                {
                    prev.status = TranslationStatus::Overidden;
                }
            })
            .or_insert(vec![new_index]);

        self.translations.push(Translation {
            id: new_index as u64,
            locale,
            key,
            value,
            proposed: Attribution { who: user_id, when: now },
            status: TranslationStatus::Proposed,
        });

        Some(new_index as u64)
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
                let mut deployment_count: u32 = 0;
                let mut candidates: Vec<CandidateTranslation> = Vec::new();

                for id in ids {
                    if let Some(translation) = self.translations.get(*id) {
                        match translation.status {
                            TranslationStatus::Proposed => candidates.push(CandidateTranslation {
                                id: *id as u64,
                                value: translation.value.clone(),
                                proposed_by: translation.proposed.who,
                                proposed_at: translation.proposed.when,
                            }),
                            TranslationStatus::Deployed(_) => deployment_count += 1,
                            _ => (),
                        }
                    }
                }

                if candidates.is_empty() {
                    None
                } else {
                    Some(Record {
                        locale: locale.clone(),
                        key: key.clone(),
                        candidates,
                        deployment_count,
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

    fn find_most_recent_approved_or_deployed(&self, ids: &[usize]) -> Option<&Translation> {
        ids.iter()
            .rev()
            .filter_map(|id| self.translations.get(*id))
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
