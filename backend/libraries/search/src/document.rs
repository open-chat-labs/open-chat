use std::{cmp::max_by, collections::HashSet};
use types::UserId;

type Milliseconds = u64;

pub struct Query {
    pub tokens: Vec<Token>,
    pub users: HashSet<UserId>,
}

pub struct Token {
    pub value: String,
    pub value_lower: String,
}

impl Token {
    fn new(text: String) -> Token {
        let value_lower = text.to_lowercase();
        Token {
            value: text,
            value_lower,
        }
    }
}

impl Query {
    pub fn parse(free_text: String) -> Query {
        Query {
            tokens: parse_tokens(free_text),
            users: HashSet::new(),
        }
    }
}

pub struct Field {
    tokens: Vec<Token>,
    weight: f32,
}

impl Field {
    fn new(free_text: String, weight: f32, split: bool) -> Field {
        Field {
            tokens: if split { parse_tokens(free_text) } else { vec![Token::new(free_text)] },
            weight,
        }
    }
}

#[derive(Default)]
pub struct Document {
    fields: Vec<Field>,
    age: Option<Milliseconds>,
}

impl Document {
    pub fn add_field(&mut self, value: String, weight: f32, split: bool) -> &mut Document {
        self.fields.push(Field::new(value, weight, split));
        self
    }

    pub fn set_age(&mut self, age: Milliseconds) -> &mut Document {
        self.age = Some(age);
        self
    }

    // The search term is split into words and each word is matched against each field
    // There is a match if at least one word matches at least one field case insensitive
    // Extra weight is given:
    // 1. for matching all words
    // 2. for matching all fields
    // 3. for case-sensitive matches
    // 4. the shorter the matching field(s)
    // 5. if the word matches the start of the field
    // A score of zero means no match
    pub fn calculate_score(&self, query: &Query) -> u32 {
        (self.calculate_score_internal(query) * 10000.0) as u32
    }

    pub fn calculate_score_internal(&self, query: &Query) -> f32 {
        let mut score = 0.0;

        for field in &self.fields {
            score += score_field(query, field);
        }

        if score > 0.0 {
            if let Some(age) = self.age {
                score * calculate_age_boost(age)
            } else {
                score
            }
        } else {
            0.0
        }
    }
}

fn score_field(query: &Query, field: &Field) -> f32 {
    if query.tokens.is_empty() {
        return 0.0;
    }

    let mut total = 0.0;

    for token in &query.tokens {
        total += score_field_for_token(token, field);
    }

    // Average of token matches
    let score = total / (query.tokens.len() as f32);

    if score > 0.0 {
        score * field.weight
    } else {
        0.0
    }
}

fn score_field_for_token(search_token: &Token, field: &Field) -> f32 {
    let mut max_score: f32 = 0.0;

    // Max of token matches
    for field_token in &field.tokens {
        let score = score_token_match(search_token, field_token) * calculate_length_boost(field_token.value.len() as f32);
        max_score = max_by(max_score, score, |a, b| a.partial_cmp(b).unwrap());
    }

    max_score
}

fn score_token_match(search_token: &Token, field_token: &Token) -> f32 {
    if field_token.value.starts_with(&search_token.value) {
        5.0
    } else if field_token.value_lower.starts_with(&search_token.value_lower) {
        3.0
    } else if field_token.value.contains(&search_token.value) {
        2.0
    } else if field_token.value_lower.contains(&search_token.value_lower) {
        1.0
    } else {
        0.0
    }
}

fn calculate_length_boost(x: f32) -> f32 {
    1.0 + (-x / 20.0).exp()
}

fn calculate_age_boost(age: Milliseconds) -> f32 {
    let age_in_days = (age / (1000 * 60 * 60 * 24)) as f32;
    1.0 + (-age_in_days / 20.0).exp()
}

fn parse_tokens(text: String) -> Vec<Token> {
    text.split_whitespace().map(|word| Token::new(word.to_string())).collect()
}
