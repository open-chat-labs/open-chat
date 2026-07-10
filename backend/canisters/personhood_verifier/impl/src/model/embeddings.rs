use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;

pub const EMBEDDING_DIM: usize = 512;

// i8-quantized L2-normalized embeddings keyed by (model version, user).
// Heap-backed for the skeleton phase; the design moves this to a
// StableBTreeMap before real scale (100k users ~ 51MB serialized).
#[derive(Serialize, Deserialize, Default)]
pub struct EmbeddingStore {
    by_version: HashMap<u16, HashMap<UserId, Vec<i8>>>,
}

pub enum ScanOutcome {
    Unique,
    // Similarity in the gray zone - one stricter retry round is offered
    Inconclusive,
    Duplicate,
}

impl EmbeddingStore {
    pub fn insert(&mut self, model_version: u16, user_id: UserId, embedding: Vec<i8>) {
        self.by_version.entry(model_version).or_default().insert(user_id, embedding);
    }

    pub fn contains(&self, model_version: u16, user_id: &UserId) -> bool {
        self.by_version.get(&model_version).is_some_and(|m| m.contains_key(user_id))
    }

    // Deletes every embedding of a lapsed model version
    pub fn remove_version(&mut self, model_version: u16) -> usize {
        self.by_version.remove(&model_version).map_or(0, |m| m.len())
    }

    pub fn remove_user(&mut self, user_id: &UserId) {
        for map in self.by_version.values_mut() {
            map.remove(user_id);
        }
    }

    pub fn count(&self, model_version: u16) -> usize {
        self.by_version.get(&model_version).map_or(0, |m| m.len())
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
        let Some(map) = self.by_version.get(&model_version) else {
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
