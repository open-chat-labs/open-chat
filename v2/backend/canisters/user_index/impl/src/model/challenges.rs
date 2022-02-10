use captcha::filters::Wave;
use rand_chacha::rand_core::{RngCore, SeedableRng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Challenge, ChallengeAttempt, ChallengeKey, Salt, TimestampMillis};

const CAPTCHA_CHALLENGE_LIFETIME_MILLIS: u64 = 5 * 60 * 1000; // 5 minutes
const MAX_INFLIGHT_CHALLENGES: u32 = 500;

#[derive(Serialize, Deserialize, Default)]
pub struct Challenges {
    inflight: HashMap<ChallengeKey, ChallengeSolution>,
    test_mode: bool,
    #[serde(skip)]
    rng: Option<rand_chacha::ChaCha20Rng>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChallengeSolution {
    created: TimestampMillis,
    chars: String,
}

struct Base64(String);

impl Challenges {
    pub fn new(test_mode: bool) -> Challenges {
        Challenges {
            inflight: HashMap::default(),
            test_mode,
            rng: None,
        }
    }

    pub fn is_initialised(&self) -> bool {
        self.rng.is_some()
    }

    pub fn initialise(&mut self, seed: Salt) {
        self.rng = Some(rand_chacha::ChaCha20Rng::from_seed(seed));
    }

    pub fn create(&mut self, now: TimestampMillis) -> Option<Challenge> {
        // Remove any expired challenges
        self.inflight.retain(|_, s| !s.expired(now));

        if self.count() >= MAX_INFLIGHT_CHALLENGES {
            return None;
        }

        if let Some(rng) = &mut self.rng {
            // Try generating a unique key or trap after 10 attempts
            const MAX_TRIES: u8 = 10;
            for _ in 0..MAX_TRIES {
                let challenge_key = random_string(rng, 10);

                if !self.inflight.contains_key(&challenge_key) {
                    // Create the CAPTCHA
                    let (Base64(png_base64), chars) = create_captcha(rng);

                    // Remember the solution
                    self.inflight
                        .insert(challenge_key.clone(), ChallengeSolution { created: now, chars });

                    // Return the challenge
                    return Some(Challenge {
                        png_base64,
                        challenge_key,
                    });
                }
            }

            ic_cdk::trap(&format!("Could not find a new challenge key after {} tries", MAX_TRIES));
        } else {
            ic_cdk::trap("RNG not initialised");
        }
    }

    pub fn check(&mut self, attempt: &ChallengeAttempt, now: TimestampMillis) -> bool {
        if self.test_mode && attempt.key == "TEST" && attempt.chars == "TEST" {
            return true;
        }

        if let Some(solution) = self.inflight.get(&attempt.key) {
            let success = !solution.expired(now) && solution.chars == attempt.chars;
            if !success {
                // Remove the failed challenge so it can't be retried
                self.inflight.remove(&attempt.key);
            }
            success
        } else {
            false
        }
    }

    pub fn count(&self) -> u32 {
        self.inflight.len() as u32
    }
}

impl ChallengeSolution {
    fn expired(&self, now: TimestampMillis) -> bool {
        now > (self.created + CAPTCHA_CHALLENGE_LIFETIME_MILLIS)
    }
}

fn create_captcha<T: RngCore>(rng: T) -> (Base64, String) {
    let mut captcha = captcha::RngCaptcha::from_rng(rng);
    let captcha = captcha
        .add_chars(5)
        .apply_filter(Wave::new(2.0, 20.0).horizontal())
        .apply_filter(Wave::new(2.0, 20.0).vertical())
        .view(220, 120);

    let resp = match captcha.as_base64() {
        Some(png_base64) => Base64(png_base64),
        None => ic_cdk::trap("Could not get base64 of captcha"),
    };

    (resp, captcha.chars_as_string())
}

// Generate an n-char long string of random characters. The characters are sampled from the rang
// a-z.
//
// NOTE: The 'rand' crate (currently) does not build on wasm32-unknown-unknown so we have to
// make-do with the RngCore trait (as opposed to Rng), therefore we have to implement this
// ourselves as opposed to using one of rand's distributions.
fn random_string<T: RngCore>(rng: &mut T, n: usize) -> String {
    let mut chars: Vec<u8> = vec![];

    // The range
    let a = b'a';
    let z = b'z';

    // n times, get a random number as u32, then shrink to u8, and finally shrink to the size of
    // our range. Finally, offset by the start of our range.
    for _ in 0..n {
        let next: u8 = rng.next_u32() as u8 % (z - a) + a;
        chars.push(next);
    }

    return String::from_utf8_lossy(&chars).to_string();
}
