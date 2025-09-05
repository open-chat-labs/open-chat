use serde::Deserializer;
use std::fmt::{self, Display};
use std::marker::PhantomData;
use std::str::FromStr;

struct NumberVisitor<T> {
    marker: PhantomData<T>,
}

impl<'de, T> serde::de::Visitor<'de> for NumberVisitor<T>
where
    T: TryFrom<u64> + TryFrom<i64> + TryFrom<u128> + TryFrom<i128> + FromStr,
    <T as TryFrom<u64>>::Error: Display,
    <T as TryFrom<i64>>::Error: Display,
    <T as TryFrom<u128>>::Error: Display,
    <T as TryFrom<i128>>::Error: Display,
    <T as FromStr>::Err: Display,
{
    type Value = T;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("an integer or string")
    }

    fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        T::try_from(v).map_err(serde::de::Error::custom)
    }

    fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        T::try_from(v).map_err(serde::de::Error::custom)
    }

    fn visit_u128<E>(self, v: u128) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        T::try_from(v).map_err(serde::de::Error::custom)
    }

    fn visit_i128<E>(self, v: i128) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        T::try_from(v).map_err(serde::de::Error::custom)
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        v.parse().map_err(serde::de::Error::custom)
    }
}

pub fn deserialize_int_or_string<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: TryFrom<u64> + TryFrom<i64> + TryFrom<u128> + TryFrom<i128> + FromStr,
    <T as TryFrom<u64>>::Error: Display,
    <T as TryFrom<i64>>::Error: Display,
    <T as TryFrom<u128>>::Error: Display,
    <T as TryFrom<i128>>::Error: Display,
    <T as FromStr>::Err: Display,
{
    deserializer.deserialize_any(NumberVisitor { marker: PhantomData })
}
