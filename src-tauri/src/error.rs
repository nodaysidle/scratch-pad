use serde::Serialize;

/// The only error a command returns. The frontend shows `message`; nothing raw crosses the boundary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "kebab-case")]
pub enum AppError {
    Storage(String),
    NotFound(String),
    Invalid(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Storage(text) | Self::NotFound(text) | Self::Invalid(text) => f.write_str(text),
        }
    }
}

impl std::error::Error for AppError {}
