"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("email", ASCENDING)], name="email", unique=True),
              IndexModel([("role", ASCENDING), ("class_id", ASCENDING)], name="role_class")],
    "classes": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "questions": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("topic_id", ASCENDING)], name="topic"),
                  IndexModel([("scope", ASCENDING), ("area", ASCENDING)], name="scope_area")],
    "attempts": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                 IndexModel([("user_id", ASCENDING), ("status", ASCENDING), ("finished_at", DESCENDING)], name="user_status"),
                 IndexModel([("status", ASCENDING), ("date", ASCENDING)], name="status_date")],
    "xp_events": [IndexModel([("user_id", ASCENDING), ("date", ASCENDING)], name="user_date"), IndexModel([("date", ASCENDING)], name="date")],
    "access_log": [IndexModel([("user_id", ASCENDING), ("date", ASCENDING)], name="user_date", unique=True), IndexModel([("date", ASCENDING)], name="date")],
    "custom_quizzes": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("grade", ASCENDING), ("created_at", DESCENDING)], name="grade_created")],
    "materials": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("created_at", DESCENDING)], name="created")],
    "mural": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("publish_at", DESCENDING)], name="publish")],
    "content_views": [IndexModel([("user_id", ASCENDING), ("kind", ASCENDING), ("item_id", ASCENDING)], name="uniq", unique=True)],
    "essays": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
    "tutor_messages": [IndexModel([("session_id", ASCENDING), ("user_id", ASCENDING), ("created_at", ASCENDING)], name="session")],
    "tutor_sessions": [IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="user_updated")],
    "duels": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("challenger_id", ASCENDING), ("created_at", DESCENDING)], name="challenger"),
              IndexModel([("opponent_id", ASCENDING), ("created_at", DESCENDING)], name="opponent"), IndexModel([("winner_id", ASCENDING)], name="winner")],
    "settings": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
