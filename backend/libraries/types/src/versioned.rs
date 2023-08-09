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

    pub fn update(&self, value: T) -> Versioned<T> {
        Versioned {
            value,
            version: self.version.incr(),
        }
    }

    pub fn if_set_after(&self, version: Version) -> Option<&T> {
        if self.version > version {
            Some(&self.value)
        } else {
            None
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
