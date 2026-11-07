"""
Router: Automated Background Notification Engine & Alert Scanner
================================================================
Provides endpoints to automatically scan user purchases for impending
return deadlines, sync urgent reminders into the Supabase 'reminders'
table, and expose scheduler health status.
"""

import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, status
from supabase import create_client, Client
from dotenv import load_dotenv

# Ensure local backend environment variables are loaded
load_dotenv()

logger = logging.getLogger("smartreturn.notifications")
logging.basicConfig(level=logging.INFO)

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications & Alerts"]
)

# Global tracker for scanner status
_scanner_state = {
    "last_scan_timestamp": None,
    "last_scanned_count": 0,
    "last_created_count": 0,
    "total_active_reminders": 0,
    "scheduler_running": False,
    "scheduler_task": None
}


def get_supabase_client() -> Client:
    """Initializes and returns a Supabase client using environment variables."""
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_KEY", "").strip()

    if not url or not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL or SUPABASE_KEY missing from environment."
        )

    return create_client(url, key)


def scan_deadlines_sync() -> Dict[str, Any]:
    """
    Core scanning logic:
    1. Computes UTC range: [today, today + 7 days].
    2. Queries Supabase 'purchases' table for expiring return deadlines.
    3. Checks for existing reminders to avoid duplicate alerts.
    4. Inserts automated reminder records into 'reminders'.
    5. Updates global health stats.
    """
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    plus_7_str = (now + timedelta(days=7)).strftime("%Y-%m-%d")

    client = get_supabase_client()

    try:
        # 1. Query purchases expiring in the next 7 days
        purchases_res = (
            client.table("purchases")
            .select("id, user_id, product_name, store, return_deadline, price, currency")
            .gte("return_deadline", today_str)
            .lte("return_deadline", plus_7_str)
            .execute()
        )
        expiring_purchases = purchases_res.data or []

        # 2. Query all existing reminders in that date range to prevent duplicates
        reminders_res = (
            client.table("reminders")
            .select("id, user_id, title, due_date, is_read")
            .gte("due_date", today_str)
            .lte("due_date", plus_7_str)
            .execute()
        )
        existing_reminders = reminders_res.data or []

        created_records = []

        # 3. Check for duplicates and prepare insertions
        for p in expiring_purchases:
            user_id = p.get("user_id")
            return_deadline = p.get("return_deadline")
            product_name = p.get("product_name", "Purchased Item")

            # Check if reminder already exists for this purchase / due date
            already_exists = any(
                r.get("user_id") == user_id
                and r.get("due_date") == return_deadline
                and product_name in (r.get("title") or "")
                for r in existing_reminders
            )

            if not already_exists:
                reminder_payload = {
                    "user_id": user_id,
                    "title": f"Return Window Closing: {product_name}",
                    "due_date": return_deadline,
                    "type": "return",
                    "is_read": False,
                }
                insert_res = client.table("reminders").insert(reminder_payload).execute()
                if insert_res.data:
                    created_records.extend(insert_res.data)

        # 4. Count total active unread reminders
        unread_count_res = (
            client.table("reminders")
            .select("id", count="exact")
            .eq("is_read", False)
            .execute()
        )
        total_unread = unread_count_res.count if unread_count_res.count is not None else len(unread_count_res.data or [])

        # Update global state
        timestamp_now = now.isoformat()
        _scanner_state["last_scan_timestamp"] = timestamp_now
        _scanner_state["last_scanned_count"] = len(expiring_purchases)
        _scanner_state["last_created_count"] = len(created_records)
        _scanner_state["total_active_reminders"] = total_unread

        logger.info(
            f"[NotificationScanner] Scanned {len(expiring_purchases)} expiring items; "
            f"created {len(created_records)} new reminders. Total active: {total_unread}."
        )

        return {
            "status": "success",
            "timestamp": timestamp_now,
            "window": {"from": today_str, "to": plus_7_str},
            "scanned_expiring_purchases": len(expiring_purchases),
            "new_reminders_created": len(created_records),
            "total_active_unread_reminders": total_unread,
        }
    except Exception as e:
        logger.error(f"[NotificationScanner] Scan failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database deadline scanner failed: {str(e)}"
        )


@router.post("/scan-deadlines")
def trigger_deadline_scan():
    """
    Manual invocation endpoint:
    Scans purchases with deadlines expiring in the next 7 days and inserts
    reminders into public.reminders if not already recorded.
    """
    return scan_deadlines_sync()


@router.get("/status")
def get_scanner_status():
    """
    Health & Cron Status:
    Exposes last scan timestamp, unread reminder count, and background scheduler state.
    """
    return {
        "status": "online",
        "scheduler_running": _scanner_state["scheduler_running"],
        "last_scan_timestamp": _scanner_state["last_scan_timestamp"],
        "last_scanned_count": _scanner_state["last_scanned_count"],
        "last_created_count": _scanner_state["last_created_count"],
        "total_active_reminders": _scanner_state["total_active_reminders"],
    }


async def background_scheduler_loop():
    """
    Automated Background Scheduler loop:
    Runs scan_deadlines automatically on startup and every 24 hours thereafter.
    """
    _scanner_state["scheduler_running"] = True
    logger.info("[NotificationScheduler] Background alert engine initialized (interval: 24h).")

    while True:
        try:
            # Run scan in threadpool to avoid blocking event loop
            await asyncio.to_thread(scan_deadlines_sync)
        except Exception as e:
            logger.warning(f"[NotificationScheduler] Background loop iteration notice: {e}")

        # Sleep for 24 hours (86,400 seconds)
        await asyncio.sleep(86400)


def start_notification_scheduler():
    """Starts the background scheduler task in the running event loop."""
    if _scanner_state.get("scheduler_task") is None:
        loop = asyncio.get_event_loop()
        _scanner_state["scheduler_task"] = loop.create_task(background_scheduler_loop())
