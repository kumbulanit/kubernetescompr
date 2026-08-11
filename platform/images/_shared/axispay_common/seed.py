"""In-memory seed data for Day 1 and Day 2.

Everything here is FICTIONAL. No real merchant, customer, bank or card is
represented. Card data does not exist in this platform at all — only tokens of
the form tok_… . There is no PAN field, not even in fixtures.

On Day 3 this module is replaced by PostgreSQL with the same shape, so the
service code does not change. Students see the data move from memory to a
database without the business logic being touched.
"""
from typing import Any, Dict, List

MERCHANTS: List[Dict[str, Any]] = [
    # merchant_id, trading_name, country, mcc, kyc, mdr_bps, fixed_fee_minor, currency, webhook
    {"merchant_id": "MER_7QK2XD9P4A", "legal_name": "Kalahari Coffee Roasters (Pty) Ltd", "trading_name": "Kalahari Coffee Roasters", "country": "ZA", "mcc": "5499", "kyc_status": "verified", "mdr_bps": 180, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://hooks.kalaharicoffee.example/axispay", "active": True},
    {"merchant_id": "MER_3HN8VB2M6C", "legal_name": "Zambezi Logistics Limited", "trading_name": "Zambezi Logistics", "country": "ZA", "mcc": "4214", "kyc_status": "verified", "mdr_bps": 145, "fixed_fee_minor": 200, "settlement_currency": "ZAR", "webhook_url": "https://api.zambezilog.example/webhooks/payments", "active": True},
    {"merchant_id": "MER_9PL4KD7T2X", "legal_name": "Table Bay Outfitters CC", "trading_name": "Table Bay Outfitters", "country": "ZA", "mcc": "5651", "kyc_status": "verified", "mdr_bps": 210, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://tablebay.example/pay/callback", "active": True},
    {"merchant_id": "MER_5RT2WQ8N3J", "legal_name": "Sahara Digital Media FZ-LLC", "trading_name": "Sahara Digital Media", "country": "AE", "mcc": "7311", "kyc_status": "verified", "mdr_bps": 250, "fixed_fee_minor": 100, "settlement_currency": "USD", "webhook_url": "https://saharadigital.example/hooks", "active": True},
    {"merchant_id": "MER_8DF6JH4V9B", "legal_name": "Ubuntu Health Supplies (Pty) Ltd", "trading_name": "Ubuntu Health Supplies", "country": "ZA", "mcc": "5912", "kyc_status": "verified", "mdr_bps": 165, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://ubuntuhealth.example/axispay/events", "active": True},
    {"merchant_id": "MER_2XC7MN5K8L", "legal_name": "Lagos Fresh Foods Ltd", "trading_name": "Lagos Fresh Foods", "country": "NG", "mcc": "5411", "kyc_status": "verified", "mdr_bps": 195, "fixed_fee_minor": 5000, "settlement_currency": "NGN", "webhook_url": "https://lagosfresh.example/payments/webhook", "active": True},
    {"merchant_id": "MER_6BV3ZQ9W4H", "legal_name": "Nairobi Cloud Services Ltd", "trading_name": "Nairobi Cloud Services", "country": "KE", "mcc": "7372", "kyc_status": "verified", "mdr_bps": 220, "fixed_fee_minor": 2000, "settlement_currency": "KES", "webhook_url": "https://nairobicloud.example/api/hooks", "active": True},
    {"merchant_id": "MER_4KJ9PT6R2D", "legal_name": "Okavango Safari Company (Pty) Ltd", "trading_name": "Okavango Safari Co", "country": "BW", "mcc": "4722", "kyc_status": "verified", "mdr_bps": 275, "fixed_fee_minor": 300, "settlement_currency": "BWP", "webhook_url": "https://okavangosafari.example/hooks/pay", "active": True},
    {"merchant_id": "MER_7WS5WD3F8G", "legal_name": "Drakensberg Wine Estate (Pty) Ltd", "trading_name": "Drakensberg Wines", "country": "ZA", "mcc": "5921", "kyc_status": "verified", "mdr_bps": 230, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://drakensbergwines.example/callback", "active": True},
    {"merchant_id": "MER_3QA8HK5Y7N", "legal_name": "Gaborone Auto Parts (Pty) Ltd", "trading_name": "Gaborone Auto Parts", "country": "BW", "mcc": "5533", "kyc_status": "verified", "mdr_bps": 175, "fixed_fee_minor": 300, "settlement_currency": "BWP", "webhook_url": "https://gaboroneauto.example/axispay", "active": True},
    {"merchant_id": "MER_9ZX4CV2B6M", "legal_name": "Cape Fold Analytics (Pty) Ltd", "trading_name": "Cape Fold Analytics", "country": "ZA", "mcc": "7372", "kyc_status": "verified", "mdr_bps": 240, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://capefold.example/webhooks/axispay", "active": True},
    {"merchant_id": "MER_5NM7BG4T9K", "legal_name": "Serengeti Textiles Ltd", "trading_name": "Serengeti Textiles", "country": "KE", "mcc": "5691", "kyc_status": "verified", "mdr_bps": 185, "fixed_fee_minor": 2000, "settlement_currency": "KES", "webhook_url": "https://serengetitextiles.example/pay", "active": True},
    {"merchant_id": "MER_8LK2JH6D3S", "legal_name": "Winelands Boutique Hotels (Pty) Ltd", "trading_name": "Winelands Hotels", "country": "ZA", "mcc": "7011", "kyc_status": "verified", "mdr_bps": 260, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://winelandshotels.example/hooks", "active": True},
    {"merchant_id": "MER_2VF9RD5X7C", "legal_name": "Atlantic Seaboard Fitness CC", "trading_name": "Atlantic Fitness", "country": "ZA", "mcc": "7997", "kyc_status": "verified", "mdr_bps": 200, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://atlanticfitness.example/axispay", "active": True},
    {"merchant_id": "MER_6TY3WQ8Z4P", "legal_name": "Kilimanjaro Trekking Ltd", "trading_name": "Kilimanjaro Trekking", "country": "KE", "mcc": "4722", "kyc_status": "verified", "mdr_bps": 290, "fixed_fee_minor": 2000, "settlement_currency": "KES", "webhook_url": "https://kilitrek.example/webhook", "active": True},
    {"merchant_id": "MER_4HG7NB2M9V", "legal_name": "Highveld Electronics (Pty) Ltd", "trading_name": "Highveld Electronics", "country": "ZA", "mcc": "5732", "kyc_status": "verified", "mdr_bps": 155, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://highveldelec.example/pay/hook", "active": True},
    {"merchant_id": "MER_9CD5XS3K7L", "legal_name": "Victoria Falls Adventures Ltd", "trading_name": "Vic Falls Adventures", "country": "ZA", "mcc": "7999", "kyc_status": "pending", "mdr_bps": 300, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://vicfallsadv.example/hooks", "active": False},
    {"merchant_id": "MER_7JN4KP6W2R", "legal_name": "Karoo Organic Farms (Pty) Ltd", "trading_name": "Karoo Organic", "country": "ZA", "mcc": "5499", "kyc_status": "verified", "mdr_bps": 170, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://karooorganic.example/axispay", "active": True},
    {"merchant_id": "MER_3BM8VC5T4X", "legal_name": "Accra Mobile Money Agents Ltd", "trading_name": "Accra Mobile Agents", "country": "NG", "mcc": "6012", "kyc_status": "review", "mdr_bps": 320, "fixed_fee_minor": 5000, "settlement_currency": "NGN", "webhook_url": "https://accramobile.example/hooks", "active": True},
    {"merchant_id": "MER_5WQ2ZN9H6D", "legal_name": "Durban Port Services (Pty) Ltd", "trading_name": "Durban Port Services", "country": "ZA", "mcc": "4214", "kyc_status": "verified", "mdr_bps": 135, "fixed_fee_minor": 200, "settlement_currency": "ZAR", "webhook_url": "https://durbanport.example/api/webhook", "active": True},
    {"merchant_id": "MER_8RT6YU3J5N", "legal_name": "Sandton Legal Partners Inc", "trading_name": "Sandton Legal", "country": "ZA", "mcc": "8111", "kyc_status": "verified", "mdr_bps": 250, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://sandtonlegal.example/pay", "active": True},
    {"merchant_id": "MER_2KL9PD4F7B", "legal_name": "Thames Valley Imports Ltd", "trading_name": "Thames Valley Imports", "country": "GB", "mcc": "5199", "kyc_status": "verified", "mdr_bps": 125, "fixed_fee_minor": 20, "settlement_currency": "GBP", "webhook_url": "https://thamesvalley.example/hooks/axispay", "active": True},
    {"merchant_id": "MER_6HN3MV8Q2W", "legal_name": "Rhine Digital Commerce GmbH", "trading_name": "Rhine Digital", "country": "DE", "mcc": "5817", "kyc_status": "verified", "mdr_bps": 140, "fixed_fee_minor": 25, "settlement_currency": "EUR", "webhook_url": "https://rhinedigital.example/webhook", "active": True},
    {"merchant_id": "MER_4XZ7CB5R9T", "legal_name": "Namib Desert Lodges (Pty) Ltd", "trading_name": "Namib Desert Lodges", "country": "BW", "mcc": "7011", "kyc_status": "verified", "mdr_bps": 280, "fixed_fee_minor": 300, "settlement_currency": "BWP", "webhook_url": "https://namiblodges.example/axispay/hook", "active": True},
    {"merchant_id": "MER_9GF2JK6L3M", "legal_name": "Soweto Community Pharmacy CC", "trading_name": "Soweto Pharmacy", "country": "ZA", "mcc": "5912", "kyc_status": "verified", "mdr_bps": 160, "fixed_fee_minor": 150, "settlement_currency": "ZAR", "webhook_url": "https://sowetopharm.example/hooks", "active": True},
]

# Merchant API keys. Fictional. In a real platform these are hashed at rest and
# never logged; that limitation is discussed honestly on Day 3 (M3.2).
API_KEYS: Dict[str, str] = {
    "ak_live_kalahari_7QK2XD9P4A": "MER_7QK2XD9P4A",
    "ak_live_zambezi_3HN8VB2M6C": "MER_3HN8VB2M6C",
    "ak_live_tablebay_9PL4KD7T2X": "MER_9PL4KD7T2X",
    "ak_live_sahara_5RT2WQ8N3J": "MER_5RT2WQ8N3J",
    "ak_test_sandbox_0000000000": "MER_7QK2XD9P4A",
}

CARD_TOKENS: List[Dict[str, Any]] = [
    {"card_token": "tok_a71ef4c2900bd5386ff1240e", "brand": "visa", "last4": "4242", "exp_month": 11, "exp_year": 2029, "issuer_country": "ZA"},
    {"card_token": "tok_5d3b8e1f47a90c26db55f083", "brand": "mastercard", "last4": "8210", "exp_month": 3, "exp_year": 2028, "issuer_country": "ZA"},
    {"card_token": "tok_c92f60ab3d17e8459cb2740d", "brand": "visa", "last4": "1881", "exp_month": 7, "exp_year": 2027, "issuer_country": "GB"},
    {"card_token": "tok_1e845fd60b93ac72510ef3b6", "brand": "amex", "last4": "0005", "exp_month": 1, "exp_year": 2030, "issuer_country": "US"},
    {"card_token": "tok_7b02cd94e5fa138067ad4192", "brand": "mastercard", "last4": "5544", "exp_month": 9, "exp_year": 2028, "issuer_country": "NG"},
    {"card_token": "tok_3f6a91e0c48db275ae30165c", "brand": "visa", "last4": "9316", "exp_month": 5, "exp_year": 2029, "issuer_country": "KE"},
]

MERCHANTS_BY_ID: Dict[str, Dict[str, Any]] = {m["merchant_id"]: m for m in MERCHANTS}
TOKENS_BY_ID: Dict[str, Dict[str, Any]] = {t["card_token"]: t for t in CARD_TOKENS}
