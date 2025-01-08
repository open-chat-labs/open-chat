use rand::distributions::Standard;
use rand::prelude::Distribution;
use rand::rngs::StdRng;
use rand::Rng;
use rand::SeedableRng;
use std::cell::RefCell;

thread_local! {
    static RNG: RefCell<Option<StdRng>> = RefCell::default();
}

const RNG_ALREADY_INITIALIZED: &str = "RNG has already been initialized";
const RNG_NOT_INITIALIZED: &str = "RNG has not been initialized";

pub fn init(seed: [u8; 32]) {
    RNG.with_borrow_mut(|s| {
        if s.is_some() {
            panic!("{}", RNG_ALREADY_INITIALIZED);
        } else {
            *s = Some(StdRng::from_seed(seed));
        }
    })
}

pub fn gen<T>() -> T
where
    Standard: Distribution<T>,
{
    RNG.with_borrow_mut(|s| s.as_mut().expect(RNG_NOT_INITIALIZED).gen::<T>())
}
