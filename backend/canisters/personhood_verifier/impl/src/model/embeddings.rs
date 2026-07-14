use crate::memory::{Memory, get_embeddings_memory};
use candid::Principal;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;

pub const EMBEDDING_DIM: usize = 512;

// i8-quantized L2-normalized embeddings keyed by (model version, user).
//
// Hybrid storage: a StableBTreeMap is the source of truth (nothing to
// (de)serialize through upgrades, however large the enrolled population
// grows), while a heap cache mirrors it for the hot path - every
// verification brute-force scans all enrolled embeddings, and a contiguous
// heap scan is an order of magnitude cheaper in instructions than
// deserializing every entry out of stable memory per verification (see
// backend/personhood_bench). The cache is rebuilt from the stable map in
// post_upgrade.
#[derive(Serialize, Deserialize)]
pub struct EmbeddingStore {
    // Pre-hybrid heap storage, drained into the stable map by rebuild_cache
    // on the first upgrade that carries this code. Field name kept for serde
    // compatibility; always empty once migrated.
    #[serde(default, rename = "by_version")]
    legacy: HashMap<u16, HashMap<UserId, Vec<i8>>>,
    #[serde(skip, default = "init_stable_map")]
    stable: StableBTreeMap<Vec<u8>, Vec<u8>, Memory>,
    #[serde(skip)]
    cache: HashMap<u16, HashMap<UserId, Vec<i8>>>,
}

fn init_stable_map() -> StableBTreeMap<Vec<u8>, Vec<u8>, Memory> {
    StableBTreeMap::init(get_embeddings_memory())
}

impl Default for EmbeddingStore {
    fn default() -> Self {
        EmbeddingStore {
            legacy: HashMap::new(),
            stable: init_stable_map(),
            cache: HashMap::new(),
        }
    }
}

// Big-endian version prefix so a version's entries are contiguous in the map
fn key(model_version: u16, user_id: &UserId) -> Vec<u8> {
    let principal = Principal::from(*user_id);
    let mut key = Vec::with_capacity(2 + principal.as_slice().len());
    key.extend_from_slice(&model_version.to_be_bytes());
    key.extend_from_slice(principal.as_slice());
    key
}

fn decode_key(key: &[u8]) -> (u16, UserId) {
    let model_version = u16::from_be_bytes([key[0], key[1]]);
    (model_version, Principal::from_slice(&key[2..]).into())
}

fn to_bytes(embedding: &[i8]) -> Vec<u8> {
    embedding.iter().map(|b| *b as u8).collect()
}

fn from_bytes(bytes: &[u8]) -> Vec<i8> {
    bytes.iter().map(|b| *b as i8).collect()
}

pub enum ScanOutcome {
    Unique,
    // Similarity in the gray zone - one stricter retry round is offered
    Inconclusive,
    Duplicate,
}

impl EmbeddingStore {
    // Rebuilds the heap scan cache from the stable map. Called on init and
    // post_upgrade (the cache is structurally excluded from upgrade
    // serialization). Also drains any pre-hybrid heap embeddings into the
    // stable map the first time it runs over them.
    pub fn rebuild_cache(&mut self) {
        for (version, map) in std::mem::take(&mut self.legacy) {
            for (user_id, embedding) in map {
                self.stable.insert(key(version, &user_id), to_bytes(&embedding));
            }
        }
        self.cache.clear();
        for entry in self.stable.iter() {
            let (version, user_id) = decode_key(entry.key());
            self.cache
                .entry(version)
                .or_default()
                .insert(user_id, from_bytes(&entry.value()));
        }
    }

    pub fn insert(&mut self, model_version: u16, user_id: UserId, embedding: Vec<i8>) {
        self.stable.insert(key(model_version, &user_id), to_bytes(&embedding));
        self.cache.entry(model_version).or_default().insert(user_id, embedding);
    }

    pub fn contains(&self, model_version: u16, user_id: &UserId) -> bool {
        self.cache.get(&model_version).is_some_and(|m| m.contains_key(user_id))
    }

    // Deletes every embedding of a lapsed model version
    pub fn remove_version(&mut self, model_version: u16) -> usize {
        let keys: Vec<Vec<u8>> = self
            .stable
            .range(model_version.to_be_bytes().to_vec()..)
            .map(|entry| entry.key().clone())
            .take_while(|k| k[..2] == model_version.to_be_bytes())
            .collect();
        for k in &keys {
            self.stable.remove(k);
        }
        self.cache.remove(&model_version).map_or(0, |m| m.len())
    }

    pub fn remove_user(&mut self, user_id: &UserId) {
        for (version, map) in self.cache.iter_mut() {
            if map.remove(user_id).is_some() {
                self.stable.remove(&key(*version, user_id));
            }
        }
    }

    pub fn count(&self, model_version: u16) -> usize {
        self.cache.get(&model_version).map_or(0, |m| m.len())
    }

    // Brute-force cosine scan against every enrolled embedding of the given
    // model version, excluding the probing user's own enrollment (re-verify)
    pub fn scan(
        &self,
        model_version: u16,
        probe: &[i8],
        exclude: &UserId,
        duplicate_threshold: f32,
        clear_threshold: f32,
    ) -> (ScanOutcome, f32) {
        let Some(map) = self.cache.get(&model_version) else {
            return (ScanOutcome::Unique, 0.0);
        };
        let mut max_similarity = 0.0f32;
        for (user_id, stored) in map.iter() {
            if user_id == exclude {
                continue;
            }
            let similarity = cosine_similarity(probe, stored);
            if similarity > max_similarity {
                max_similarity = similarity;
            }
        }
        let outcome = if max_similarity >= duplicate_threshold {
            ScanOutcome::Duplicate
        } else if max_similarity >= clear_threshold {
            ScanOutcome::Inconclusive
        } else {
            ScanOutcome::Unique
        };
        (outcome, max_similarity)
    }
}

pub fn cosine_similarity(a: &[i8], b: &[i8]) -> f32 {
    // Equal length is an invariant (every embedding is EMBEDDING_DIM); a
    // mismatch means a corrupt store, so trap rather than silently score the
    // overlap and return a bogus similarity into the uniqueness decision
    assert_eq!(a.len(), b.len(), "embedding length mismatch");
    let mut dot = 0i32;
    let mut norm_a = 0i32;
    let mut norm_b = 0i32;
    for i in 0..a.len() {
        let (x, y) = (a[i] as i32, b[i] as i32);
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
    if norm_a == 0 || norm_b == 0 {
        return 0.0;
    }
    dot as f32 / ((norm_a as f32).sqrt() * (norm_b as f32).sqrt())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user(id: u8) -> UserId {
        Principal::from_slice(&[id]).into()
    }

    fn embedding(seed: i8) -> Vec<i8> {
        (0..EMBEDDING_DIM).map(|i| seed.wrapping_add(i as i8)).collect()
    }

    #[test]
    fn cache_rebuilds_from_stable_map() {
        let mut store = EmbeddingStore::default();
        store.remove_version(9); // isolate from other tests sharing the thread-local memory
        store.insert(9, user(1), embedding(3));
        store.insert(9, user(2), embedding(7));

        // Simulate an upgrade: fresh struct over the same stable memory
        let mut reloaded = EmbeddingStore::default();
        assert_eq!(reloaded.count(9), 0);
        reloaded.rebuild_cache();
        assert_eq!(reloaded.count(9), 2);
        assert!(reloaded.contains(9, &user(1)));
        assert_eq!(reloaded.cache.get(&9).unwrap().get(&user(2)).unwrap(), &embedding(7));
        reloaded.remove_version(9);
    }

    #[test]
    fn legacy_heap_embeddings_migrate_into_stable() {
        let mut legacy = HashMap::new();
        legacy.insert(11u16, HashMap::from([(user(3), embedding(5))]));
        let mut store = EmbeddingStore {
            legacy,
            ..Default::default()
        };
        store.rebuild_cache();
        assert!(store.legacy.is_empty());
        assert!(store.contains(11, &user(3)));

        // And it survives a "reload"
        let mut reloaded = EmbeddingStore::default();
        reloaded.rebuild_cache();
        assert!(reloaded.contains(11, &user(3)));
        reloaded.remove_version(11);
    }

    #[test]
    fn removals_hit_both_layers() {
        let mut store = EmbeddingStore::default();
        store.remove_version(13);
        store.insert(13, user(4), embedding(1));
        store.insert(13, user(5), embedding(2));
        store.remove_user(&user(4));
        assert_eq!(store.remove_version(13), 1);

        let mut reloaded = EmbeddingStore::default();
        reloaded.rebuild_cache();
        assert_eq!(reloaded.count(13), 0);
    }
}
