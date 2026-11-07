"""
Router: AI Return Assistant
===========================
Generates return request letters, dispute messages, and return advice
using Gemini AI for tracked purchases.
"""

import os
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from google import genai

router = APIRouter(
    prefix="/api/assistant",
    tags=["AI Assistant"]
)


class ReturnEmailRequest(BaseModel):
    product_name: str
    store_name: str
    purchase_date: str
    price: float
    currency: str
    reason: str
    order_id: Optional[str] = "N/A"


@router.post("/draft-return-email")
def draft_return_email(payload: ReturnEmailRequest):
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GEMINI_API_KEY missing from environment."
        )

    prompt = f"""
    You are an expert consumer advocate and customer service specialist.
    Draft a polite, firm, and legally sound Return Request Email for a customer to send to a store.

    Item: {payload.product_name}
    Store/Merchant: {payload.store_name}
    Order ID / Receipt Ref: {payload.order_id}
    Date Purchased: {payload.purchase_date}
    Total Paid: {payload.currency} {payload.price:.2f}
    Reason for Return: {payload.reason}

    Format the output cleanly:
    Subject Line: [Compelling Subject]

    Body:
    [Formal, polite, clear email body asking for refund confirmation and return shipping instructions]
    """

    candidate_models = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"]

    try:
        client = genai.Client(api_key=api_key)
        for model_name in candidate_models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if response.text:
                    return {"draft": response.text.strip()}
            except Exception:
                continue
    except Exception:
        pass

    # Reliable fallback template
    return {
        "draft": (
            f"Subject: Return Request: {payload.product_name} (Order #{payload.order_id})\n\n"
            f"Dear {payload.store_name} Support Team,\n\n"
            f"I am writing to formally request a return and refund for {payload.product_name}, "
            f"purchased on {payload.purchase_date} for {payload.currency} {payload.price:.2f}.\n\n"
            f"Reason for return: {payload.reason}.\n\n"
            f"Please provide return authorization details and instructions for shipment.\n\n"
            f"Sincerely,\nGeethika Divi"
        )
    }