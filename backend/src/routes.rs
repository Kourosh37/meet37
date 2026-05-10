use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use livekit_api::access_token::{AccessToken, VideoGrants};
use rand::{distr::Alphanumeric, Rng};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/rooms", post(create_room))
        .route("/rooms/{token}", get(check_room))
        .route("/rooms/{token}/join", post(join_room))
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "meet37-backend",
    })
}

#[derive(Serialize)]
struct CreateRoomResponse {
    token: String,
}

#[derive(Serialize)]
struct RoomExistsResponse {
    exists: bool,
}

#[derive(Deserialize)]
struct JoinRoomRequest {
    #[serde(rename = "displayName")]
    display_name: String,
}

#[derive(Serialize)]
struct JoinRoomResponse {
    #[serde(rename = "livekitToken")]
    livekit_token: String,
}

async fn create_room(
    State(state): State<AppState>,
) -> Result<(StatusCode, Json<CreateRoomResponse>), AppError> {
    for _ in 0..5 {
        let token = generate_room_token();
        let insert_result = sqlx::query("INSERT INTO rooms (token) VALUES ($1)")
            .bind(&token)
            .execute(&state.db_pool)
            .await;

        match insert_result {
            Ok(_) => {
                cache_room_existence(&state, &token).await;
                return Ok((StatusCode::CREATED, Json(CreateRoomResponse { token })));
            }
            Err(err) if is_unique_violation(&err) => continue,
            Err(err) => return Err(err.into()),
        }
    }

    Err(AppError::Internal)
}

async fn check_room(
    Path(token): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<RoomExistsResponse>, AppError> {
    if room_exists(&state, &token).await? {
        return Ok(Json(RoomExistsResponse { exists: true }));
    }

    Err(AppError::NotFound(format!("room `{token}` was not found")))
}

async fn join_room(
    Path(token): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<JoinRoomRequest>,
) -> Result<Json<JoinRoomResponse>, AppError> {
    let display_name = payload.display_name.trim();
    if display_name.is_empty() {
        return Err(AppError::BadRequest(
            "`displayName` cannot be empty".to_owned(),
        ));
    }

    if display_name.chars().count() > 64 {
        return Err(AppError::BadRequest(
            "`displayName` must be 64 characters or less".to_owned(),
        ));
    }

    if !room_exists(&state, &token).await? {
        return Err(AppError::NotFound(format!("room `{token}` was not found")));
    }

    let grants = VideoGrants {
        room_join: true,
        room: token,
        can_publish: true,
        can_subscribe: true,
        can_publish_data: true,
        ..Default::default()
    };

    let identity = format!("participant-{}", Uuid::new_v4().simple());
    let livekit_token = AccessToken::with_api_key(
        &state.config.livekit_api_key,
        &state.config.livekit_api_secret,
    )
    .with_identity(&identity)
    .with_name(display_name)
    .with_grants(grants)
    .to_jwt()
    .map_err(|err| AppError::External(format!("failed to generate livekit token: {err}")))?;

    Ok(Json(JoinRoomResponse { livekit_token }))
}

async fn room_exists(state: &AppState, token: &str) -> Result<bool, AppError> {
    if is_room_cached(state, token).await {
        return Ok(true);
    }

    let exists = sqlx::query("SELECT 1 FROM rooms WHERE token = $1")
        .bind(token)
        .fetch_optional(&state.db_pool)
        .await?
        .is_some();

    if exists {
        cache_room_existence(state, token).await;
    }

    Ok(exists)
}

fn generate_room_token() -> String {
    rand::rng()
        .sample_iter(Alphanumeric)
        .take(12)
        .map(char::from)
        .collect()
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    match err {
        sqlx::Error::Database(database_err) => database_err.code().as_deref() == Some("23505"),
        _ => false,
    }
}

async fn is_room_cached(state: &AppState, token: &str) -> bool {
    let key = room_cache_key(token);
    let Ok(mut conn) = state.redis_client.get_multiplexed_async_connection().await else {
        return false;
    };

    let cached: Result<Option<String>, redis::RedisError> = conn.get(&key).await;
    cached.map(|value| value.is_some()).unwrap_or(false)
}

async fn cache_room_existence(state: &AppState, token: &str) {
    let key = room_cache_key(token);
    let Ok(mut conn) = state.redis_client.get_multiplexed_async_connection().await else {
        return;
    };

    let _: Result<(), redis::RedisError> = conn.set_ex(&key, "1", 3600).await;
}

fn room_cache_key(token: &str) -> String {
    format!("room:exists:{token}")
}
