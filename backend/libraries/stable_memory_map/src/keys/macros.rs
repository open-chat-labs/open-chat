macro_rules! key {
    ($key_name:ident, $key_prefix_name:ident, $key_types:pat) => {
        #[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
        #[serde(into = "crate::keys::BaseKey", try_from = "crate::keys::BaseKey")]
        pub struct $key_name(Vec<u8>);

        #[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
        #[serde(into = "crate::keys::BaseKeyPrefix", try_from = "crate::keys::BaseKeyPrefix")]
        pub struct $key_prefix_name(Vec<u8>);

        impl From<$key_name> for BaseKey {
            fn from(value: $key_name) -> Self {
                crate::keys::BaseKey(value.0)
            }
        }

        impl From<$key_prefix_name> for crate::keys::BaseKeyPrefix {
            fn from(value: $key_prefix_name) -> Self {
                crate::keys::BaseKeyPrefix(value.0)
            }
        }

        impl TryFrom<crate::BaseKey> for $key_name {
            type Error = String;

            fn try_from(value: crate::BaseKey) -> Result<Self, Self::Error> {
                crate::keys::validate_key(&value.0, |kt| matches!(kt, $key_types)).map(|_| $key_name(value.0))
            }
        }

        impl TryFrom<crate::BaseKeyPrefix> for $key_prefix_name {
            type Error = String;

            fn try_from(value: crate::BaseKeyPrefix) -> Result<Self, Self::Error> {
                crate::keys::validate_key(&value.0, |kt| matches!(kt, $key_types)).map(|_| $key_prefix_name(value.0))
            }
        }

        impl crate::keys::Key for $key_name {
            type Prefix = $key_prefix_name;

            fn matches_prefix(&self, prefix: &$key_prefix_name) -> bool {
                self.0.starts_with(&prefix.0)
            }
        }
    };
}

pub(crate) use key;
