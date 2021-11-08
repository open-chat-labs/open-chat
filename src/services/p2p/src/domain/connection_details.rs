use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use std::collections::{
    hash_map::Entry::{Occupied, Vacant},
    HashMap,
};

#[derive(CandidType, Deserialize)]
pub struct AllConnectionDetails {
    connection_details_per_user: HashMap<UserId, Vec<ConnectionDetails>>,
}

#[derive(CandidType, Clone, Deserialize)]
pub enum ConnectionDetails {
    Offer(Offer),
    Answer(Answer),
}

#[derive(CandidType, Clone, Deserialize)]
pub struct Offer {
    id: String,
    from: UserId,
    to: UserId,
    connection_string: String,
    ice_candidates: Vec<String>,
    timestamp: Timestamp,
}

#[derive(CandidType, Clone, Deserialize)]
pub struct Answer {
    id: String,
    offer_id: String,
    from: UserId,
    to: UserId,
    connection_string: String,
    ice_candidates: Vec<String>,
    timestamp: Timestamp,
}

#[derive(CandidType)]
pub enum ConnectionDetailsSummary {
    Offer(OfferSummary),
    Answer(AnswerSummary),
}

#[derive(CandidType)]
pub struct OfferSummary {
    id: String,
    user_id: UserId,
    connection_string: String,
    ice_candidates: Vec<String>,
    age_seconds: u32,
}

#[derive(CandidType)]
pub struct AnswerSummary {
    id: String,
    offer_id: String,
    user_id: UserId,
    connection_string: String,
    ice_candidates: Vec<String>,
    age_seconds: u32,
}

pub struct Stats {
    pub user_count: u64,
}

impl AllConnectionDetails {
    pub fn add_offer(
        &mut self,
        id: String,
        me: UserId,
        them: UserId,
        connection_string: String,
        ice_candidates: Vec<String>,
        now: Timestamp,
    ) -> Option<OfferSummary> {
        // If the reverse offer already exists, return that
        if let Occupied(e) = self.connection_details_per_user.entry(me) {
            if let Some(o) = e.get().iter().find_map(|c| match c {
                ConnectionDetails::Offer(offer) => {
                    if offer.from == them {
                        Some(offer)
                    } else {
                        None
                    }
                }
                _ => None,
            }) {
                return Some(OfferSummary {
                    id: o.id.clone(),
                    user_id: them,
                    connection_string: o.connection_string.clone(),
                    ice_candidates: o.ice_candidates.to_vec(),
                    age_seconds: ((now - o.timestamp) / 1000) as u32,
                });
            }
        }

        let offer =
            ConnectionDetails::new_offer(id, me, them, connection_string, ice_candidates, now);

        self.add_connection_details(&me, them, offer);

        None
    }

    pub fn add_answer(
        &mut self,
        id: String,
        offer_id: String,
        me: UserId,
        them: UserId,
        connection_string: String,
        ice_candidates: Vec<String>,
        now: Timestamp,
    ) {
        let answer = ConnectionDetails::new_answer(
            id,
            offer_id,
            me,
            them,
            connection_string,
            ice_candidates,
            now,
        );

        self.add_connection_details(&me, them, answer);
    }

    pub fn get_connection_details(
        &self,
        to: &UserId,
        updated_since: Option<Timestamp>,
        now: Timestamp,
    ) -> Vec<ConnectionDetailsSummary> {
        match self.connection_details_per_user.get(to) {
            Some(v) => v
                .iter()
                .filter(|c| updated_since.is_none() || c.get_timestamp() > updated_since.unwrap())
                .map(|c| ConnectionDetailsSummary::new(c, now))
                .collect(),
            None => Vec::new(),
        }
    }

    pub fn remove_connection_details(&mut self, from: &UserId, to: &UserId, id: &str) -> bool {
        if let Some(v) = self.connection_details_per_user.get_mut(to) {
            let original_count = v.len();
            v.retain(|c| c.get_from_user() != from || c.get_id() != id);
            v.len() < original_count
        } else {
            false
        }
    }

    fn add_connection_details(
        &mut self,
        me: &UserId,
        them: UserId,
        connection_details: ConnectionDetails,
    ) {
        match self.connection_details_per_user.entry(them) {
            Vacant(e) => {
                e.insert(vec![connection_details]);
            }
            Occupied(e) => {
                let connections = e.into_mut();
                connections.retain(|c| c.get_from_user() != me);
                connections.push(connection_details);
            }
        };
    }

    pub fn get_stats(&self) -> Stats {
        Stats {
            user_count: self.connection_details_per_user.len() as u64,
        }
    }
}

impl ConnectionDetails {
    pub fn new_offer(
        id: String,
        from: UserId,
        to: UserId,
        connection_string: String,
        ice_candidates: Vec<String>,
        timestamp: Timestamp,
    ) -> ConnectionDetails {
        ConnectionDetails::Offer(Offer {
            id,
            from,
            to,
            connection_string,
            ice_candidates,
            timestamp,
        })
    }

    pub fn new_answer(
        id: String,
        offer_id: String,
        from: UserId,
        to: UserId,
        connection_string: String,
        ice_candidates: Vec<String>,
        timestamp: Timestamp,
    ) -> ConnectionDetails {
        ConnectionDetails::Answer(Answer {
            id,
            offer_id,
            from,
            to,
            connection_string,
            ice_candidates,
            timestamp,
        })
    }

    pub fn get_id(&self) -> &str {
        match self {
            ConnectionDetails::Offer(o) => &o.id,
            ConnectionDetails::Answer(a) => &a.id,
        }
    }

    pub fn get_from_user(&self) -> &UserId {
        match self {
            ConnectionDetails::Offer(o) => &o.from,
            ConnectionDetails::Answer(a) => &a.from,
        }
    }

    pub fn get_timestamp(&self) -> Timestamp {
        match self {
            ConnectionDetails::Offer(o) => o.timestamp,
            ConnectionDetails::Answer(a) => a.timestamp,
        }
    }
}

impl ConnectionDetailsSummary {
    pub fn new(connection_details: &ConnectionDetails, now: Timestamp) -> ConnectionDetailsSummary {
        match connection_details {
            ConnectionDetails::Offer(o) => ConnectionDetailsSummary::Offer(OfferSummary {
                id: o.id.clone(),
                user_id: o.from,
                connection_string: o.connection_string.clone(),
                ice_candidates: o.ice_candidates.to_vec(),
                age_seconds: ((now - o.timestamp) / 1000) as u32,
            }),
            ConnectionDetails::Answer(a) => ConnectionDetailsSummary::Answer(AnswerSummary {
                id: a.id.clone(),
                offer_id: a.offer_id.clone(),
                user_id: a.from,
                connection_string: a.connection_string.clone(),
                ice_candidates: a.ice_candidates.to_vec(),
                age_seconds: ((now - a.timestamp) / 1000) as u32,
            }),
        }
    }
}

impl Default for AllConnectionDetails {
    fn default() -> Self {
        AllConnectionDetails {
            connection_details_per_user: HashMap::new(),
        }
    }
}
