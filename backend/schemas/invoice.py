"""
Pydantic schemas for Invoice OCR & AI Extraction
"""

from typing import Optional
from pydantic import BaseModel, Field


class InvoiceExtractionResult(BaseModel):
    """
    Structured extraction response from Gemini AI analyzing a receipt or invoice document.
    """
    product_name: str = Field(
        ...,
        description="The primary product or item purchased (e.g. 'Sony WH-1000XM5 Headphones')"
    )
    store_name: Optional[str] = Field(
        default="",
        description="The store, merchant, or retailer name (e.g. 'Best Buy', 'Amazon', 'Target')"
    )
    category: Optional[str] = Field(
        default="Other",
        description="Product category, e.g. Electronics, Clothing, Home, Books, Other"
    )
    price: Optional[float] = Field(
        default=0.0,
        description="Total purchase price paid for the item or receipt total"
    )
    currency: Optional[str] = Field(
        default="USD",
        description="3-letter ISO currency code, e.g. USD, INR, EUR, GBP (default USD)"
    )
    purchase_date: Optional[str] = Field(
        default=None,
        description="Purchase date in ISO YYYY-MM-DD format (e.g. '2026-11-06')"
    )
    return_days: int = Field(
        default=30,
        description="Detected return window period in days; defaults to 30 if unstated on receipt"
    )
    warranty_months: int = Field(
        default=12,
        description="Detected warranty duration in months; defaults to 12 if unstated on receipt"
    )
