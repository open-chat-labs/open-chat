use crate::Version;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use std::ops::Deref;

#[derive(Serialize, Deserialize, Debug, Clone, Eq, PartialEq)]
pub struct Versioned<T> {
    #[serde(rename = "va")]
    pub value: T,
    #[serde(rename = "ve")]
    pub version: Version,
}

impl<T> Versioned<T> {
    pub fn new(value: T, version: Version) -> Versioned<T> {
        Versioned { value, version }
    }

    pub fn update(&mut self, value: T, new_version: bool) {
        self.value = value;
        if new_version {
            self.version = self.version.incr();
        }
    }
}

impl<T: Default> Default for Versioned<T> {
    fn default() -> Self {
        Versioned {
            value: T::default(),
            version: Version::zero(),
        }
    }
}

impl<T> Deref for Versioned<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}
