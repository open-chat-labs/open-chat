use crate::Hash;
use serde::{Deserialize, Serialize};
use sign_in_with_email_canister::TimestampMillis;
use std::collections::{BTreeMap, HashMap};

#[derive(Serialize, Deserialize, Default)]
pub struct MagicLinks {
    active: HashMap<(Hash, Hash), TimestampMillis>,
    stats: BTreeMap<Hash, EmailStats>,
}

#[derive(Serialize, Deserialize)]
pub struct EmailStats {
    pub first_seen: TimestampMillis,
    pub emails_sent: u32,
    pub latest_email_sent: TimestampMillis,
    pub successful_links: u32,
    pub latest_successful_link: Option<TimestampMillis>,
}

impl MagicLinks {
    pub fn mark_magic_link_sent(
        &mut self,
        seed: Hash,
        msg_hash: Hash,
        expiration: TimestampMillis,
        now: TimestampMillis,
    ) {
        self.prune_expired(now);
        self.active.insert((seed, msg_hash), expiration);
        self.stats
            .entry(seed)
            .and_modify(|s| {
                s.emails_sent += 1;
                s.latest_email_sent = now;
            })
            .or_insert(EmailStats {
                first_seen: now,
                emails_sent: 1,
                latest_email_sent: now,
                successful_links: 0,
                latest_successful_link: None,
            });
    }

    pub fn mark_success(&mut self, seed: Hash, msg_hash: Hash, now: TimestampMillis) {
        self.prune_expired(now);
        self.active.remove(&(seed, msg_hash));
        if let Some(stats) = self.stats.get_mut(&seed) {
            stats.successful_links += 1;
            stats.latest_successful_link = Some(now);
        }
    }

    fn prune_expired(&mut self, now: TimestampMillis) {
        self.active.retain(|_, ts| *ts > now)
    }
}
