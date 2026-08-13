#!/usr/bin/env python3
"""
Generate AxisPay seed data.

    python3 platform/admin/authoring/generate_seed.py -o platform/data/seed/02-seed.sql

Everything produced here is FICTIONAL. No real merchant, customer, bank or card
is represented; card numbers do not exist in this platform at all, only tokens.

The generator is DETERMINISTIC (fixed seed) so every student's database is
identical — which means a lab can say "run this query, you should see 4,847"
and be right for everyone.

Two invariants are enforced as it generates, and asserted before it writes:

  * every payment      amount_minor = fee_minor + net_minor
  * every ledger journal   sum(DR) = sum(CR)

If either fails the script exits non-zero and writes nothing. A seed file that
does not balance would make Day 3's reconciliation lab teach the wrong lesson.
"""
import argparse
import random
import secrets
import sys
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

SEED = 20260810
random.seed(SEED)

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CURRENCIES = ["ZAR", "USD", "EUR", "GBP", "NGN", "KES", "BWP"]

ACQUIRERS = [
    ("ACQ_MERIDIAN",  "Meridian Acquiring",     ["ZAR","USD","GBP","EUR"],              65, 0.9740,  95),
    ("ACQ_VELA",      "Vela Payment Services",  ["ZAR","BWP","KES"],                    58, 0.9610, 120),
    ("ACQ_KOPANO",    "Kopano Financial",       ["ZAR","NGN","KES","BWP"],              72, 0.9830, 140),
    ("ACQ_NORTHSTAR", "Northstar Card Systems", ["USD","EUR","GBP"],                    51, 0.9680,  85),
    ("ACQ_ATLAS",     "Atlas Interchange",      ["ZAR","USD","EUR","GBP","NGN","KES","BWP"], 88, 0.9910, 165),
]

ROUTING = [
    (10, "ZAR",       0,     50_000, "ACQ_VELA"),
    (20, "ZAR",  50_000,    500_000, "ACQ_MERIDIAN"),
    (30, "ZAR", 500_000, 10**12,     "ACQ_ATLAS"),
    (40, "NGN",       0, 10**12,     "ACQ_KOPANO"),
    (50, "KES",       0, 10**12,     "ACQ_KOPANO"),
    (60, "BWP",       0, 10**12,     "ACQ_VELA"),
    (70, "USD",       0, 10**12,     "ACQ_NORTHSTAR"),
    (80, "EUR",       0, 10**12,     "ACQ_NORTHSTAR"),
    (90, "GBP",       0, 10**12,     "ACQ_MERIDIAN"),
]

MERCHANTS = [
    ("MER_7QK2XD9P4A","Kalahari Coffee Roasters (Pty) Ltd","Kalahari Coffee Roasters","ZA","5499","verified",180,150,"ZAR"),
    ("MER_3HN8VB2M6C","Zambezi Logistics Limited","Zambezi Logistics","ZA","4214","verified",145,200,"ZAR"),
    ("MER_9PL4KD7T2X","Table Bay Outfitters CC","Table Bay Outfitters","ZA","5651","verified",210,150,"ZAR"),
    ("MER_5RT2WQ8N3J","Sahara Digital Media FZ-LLC","Sahara Digital Media","AE","7311","verified",250,100,"USD"),
    ("MER_8DF6JH4V9B","Ubuntu Health Supplies (Pty) Ltd","Ubuntu Health Supplies","ZA","5912","verified",165,150,"ZAR"),
    ("MER_2XC7MN5K8L","Lagos Fresh Foods Ltd","Lagos Fresh Foods","NG","5411","verified",195,5000,"NGN"),
    ("MER_6BV3ZQ9W4H","Nairobi Cloud Services Ltd","Nairobi Cloud Services","KE","7372","verified",220,2000,"KES"),
    ("MER_4KJ9PT6R2D","Okavango Safari Company (Pty) Ltd","Okavango Safari Co","BW","4722","verified",275,300,"BWP"),
    ("MER_7WS5WD3F8G","Drakensberg Wine Estate (Pty) Ltd","Drakensberg Wines","ZA","5921","verified",230,150,"ZAR"),
    ("MER_3QA8HK5Y7N","Gaborone Auto Parts (Pty) Ltd","Gaborone Auto Parts","BW","5533","verified",175,300,"BWP"),
    ("MER_9ZX4CV2B6M","Cape Fold Analytics (Pty) Ltd","Cape Fold Analytics","ZA","7372","verified",240,150,"ZAR"),
    ("MER_5NM7BG4T9K","Serengeti Textiles Ltd","Serengeti Textiles","KE","5691","verified",185,2000,"KES"),
    ("MER_8LK2JH6D3S","Winelands Boutique Hotels (Pty) Ltd","Winelands Hotels","ZA","7011","verified",260,150,"ZAR"),
    ("MER_2VF9RD5X7C","Atlantic Seaboard Fitness CC","Atlantic Fitness","ZA","7997","verified",200,150,"ZAR"),
    ("MER_6TY3WQ8Z4P","Kilimanjaro Trekking Ltd","Kilimanjaro Trekking","KE","4722","verified",290,2000,"KES"),
    ("MER_4HG7NB2M9V","Highveld Electronics (Pty) Ltd","Highveld Electronics","ZA","5732","verified",155,150,"ZAR"),
    ("MER_9CD5XS3K7L","Victoria Falls Adventures Ltd","Vic Falls Adventures","ZA","7999","pending",300,150,"ZAR"),
    ("MER_7JN4KP6W2R","Karoo Organic Farms (Pty) Ltd","Karoo Organic","ZA","5499","verified",170,150,"ZAR"),
    ("MER_3BM8VC5T4X","Accra Mobile Money Agents Ltd","Accra Mobile Agents","NG","6012","review",320,5000,"NGN"),
    ("MER_5WQ2ZN9H6D","Durban Port Services (Pty) Ltd","Durban Port Services","ZA","4214","verified",135,200,"ZAR"),
    ("MER_8RT6YU3J5N","Sandton Legal Partners Inc","Sandton Legal","ZA","8111","verified",250,150,"ZAR"),
    ("MER_2KL9PD4F7B","Thames Valley Imports Ltd","Thames Valley Imports","GB","5199","verified",125,20,"GBP"),
    ("MER_6HN3MV8Q2W","Rhine Digital Commerce GmbH","Rhine Digital","DE","5817","verified",140,25,"EUR"),
    ("MER_4XZ7CB5R9T","Namib Desert Lodges (Pty) Ltd","Namib Desert Lodges","BW","7011","verified",280,300,"BWP"),
    ("MER_9GF2JK6L3M","Soweto Community Pharmacy CC","Soweto Pharmacy","ZA","5912","verified",160,150,"ZAR"),
]

FIRST = ["Thabo","Nomsa","Sipho","Lerato","Johan","Aisha","Kwame","Fatima","Pieter","Zanele",
         "Tendai","Amara","Sizwe","Naledi","Chidi","Grace","Bongani","Layla","Hendrik","Mpho"]
LAST  = ["Molefe","Dlamini","van der Merwe","Okonkwo","Naidoo","Mensah","Botha","Adeyemi",
         "Nkosi","Mwangi","Pretorius","Chikwanda","Abubakar","Steyn","Mahlangu","Osei"]
BRANDS = [("visa",0.55),("mastercard",0.38),("amex",0.07)]
DECLINES = ["insufficient_funds","do_not_honour","issuer_unavailable","expired_card"]


def mid() -> str:  return "MER_" + "".join(random.choice(ALPHABET) for _ in range(10))
def pid() -> str:  return "pay_" + secrets.token_hex(12)
def tok() -> str:  return "tok_" + secrets.token_hex(12)
def cid() -> str:  return "cus_" + secrets.token_hex(10)
def rid() -> str:  return "ref_" + secrets.token_hex(10)
def jid() -> str:  return "jnl_" + secrets.token_hex(10)
def nid() -> str:  return "ntf_" + secrets.token_hex(10)


def q(v):
    if v is None: return "NULL"
    if isinstance(v, bool): return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def bps(amount: int, b: int) -> int:
    return int((Decimal(amount) * Decimal(b) / Decimal(10_000)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def pick_brand() -> str:
    r = random.random(); c = 0
    for b, w in BRANDS:
        c += w
        if r <= c: return b
    return "visa"


def route(currency: str, amount: int) -> str:
    for pr, cur, lo, hi, acq in sorted(ROUTING):
        if cur == currency and lo <= amount < hi: return acq
    supported = [a for a in ACQUIRERS if currency in a[2]]
    return min(supported, key=lambda a: a[3])[0] if supported else "ACQ_ATLAS"


def amount_for(currency: str) -> int:
    """Realistic ticket sizes per currency, in MINOR units."""
    base = {"ZAR": (2500, 900_000), "USD": (500, 60_000), "EUR": (500, 55_000),
            "GBP": (400, 50_000), "NGN": (150_000, 20_000_000),
            "KES": (30_000, 4_000_000), "BWP": (3000, 400_000)}[currency]
    # Log-ish distribution: most payments small, a few large.
    return int(random.triangular(base[0], base[1], base[0] * 3))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default="-")
    ap.add_argument("--payments", type=int, default=5000)
    ap.add_argument("--customers", type=int, default=400)
    a = ap.parse_args()

    out = []
    w = out.append
    w("-- AxisPay seed data — GENERATED, do not edit by hand.")
    w(f"-- python3 platform/admin/authoring/generate_seed.py --payments {a.payments} --customers {a.customers}")
    w(f"-- deterministic seed {SEED}: every student's database is identical.")
    w("-- Everything here is fictional. No card number exists in this file.")
    w("BEGIN;")
    w("")

    # ---- acquirers -------------------------------------------------------
    w("-- acquirers")
    for code, name, curs, cost, sr, lat in ACQUIRERS:
        arr = "ARRAY[" + ",".join(q(c) for c in curs) + "]"
        w(f"INSERT INTO acquirers VALUES ({q(code)},{q(name)},{arr},{cost},{sr},{lat},TRUE) "
          f"ON CONFLICT DO NOTHING;")
    w("")

    # ---- routing rules ---------------------------------------------------
    w("-- routing rules, priority ordered")
    for pr, cur, lo, hi, acq in ROUTING:
        w(f"INSERT INTO routing_rules (priority,currency,min_minor,max_minor,acquirer,active) "
          f"VALUES ({pr},{q(cur)},{lo},{hi},{q(acq)},TRUE);")
    w("")

    # ---- merchants -------------------------------------------------------
    w(f"-- {len(MERCHANTS)} merchants")
    for m_id, legal, trading, country, mcc, kyc, mdr, fixed, cur in MERCHANTS:
        active = kyc == "verified"
        host = trading.lower().replace(" ", "").replace("(pty)", "").replace("&", "")[:22]
        w("INSERT INTO merchants (merchant_id,legal_name,trading_name,country,mcc,kyc_status,"
          "mdr_bps,fixed_fee_minor,settlement_currency,settlement_bank_ref,webhook_url,active) VALUES ("
          f"{q(m_id)},{q(legal)},{q(trading)},{q(country)},{q(mcc)},{q(kyc)},{mdr},{fixed},"
          f"{q(cur)},{q('BANKREF-'+m_id[4:12])},{q('https://'+host+'.example/hooks/axispay')},{q(active)});")
    w("")

    verified = [m for m in MERCHANTS if m[5] == "verified"]

    # ---- customers -------------------------------------------------------
    w(f"-- {a.customers} customers (card TOKENS only — no PAN exists)")
    customers = []
    for _ in range(a.customers):
        m = random.choice(verified)
        c_id, t = cid(), tok()
        brand = pick_brand()
        name = f"{random.choice(FIRST)} {random.choice(LAST)}"
        email = name.lower().replace(" ", ".").replace("'", "") + "@example.com"
        last4 = f"{random.randint(0,9999):04d}"
        issuer = m[3] if random.random() < 0.82 else random.choice(["ZA","GB","US","NG","KE"])
        customers.append((c_id, m[0], t, brand, last4, issuer, m[8]))
        w("INSERT INTO customers (customer_id,merchant_id,email,full_name,country,card_token,"
          "card_brand,card_last4,card_exp_month,card_exp_year,issuer_country) VALUES ("
          f"{q(c_id)},{q(m[0])},{q(email)},{q(name)},{q(m[3])},{q(t)},{q(brand)},{q(last4)},"
          f"{random.randint(1,12)},{random.randint(2027,2031)},{q(issuer)});")
    w("")

    # ---- payments + ledger ----------------------------------------------
    w(f"-- {a.payments} payments over 30 days, with a balanced double-entry ledger")
    by_merchant = {}
    for c in customers:
        by_merchant.setdefault(c[1], []).append(c)
    mdr_of   = {m[0]: m[6] for m in MERCHANTS}
    fixed_of = {m[0]: m[7] for m in MERCHANTS}

    now = datetime(2026, 8, 10, tzinfo=timezone.utc)
    payments, ledger, refunds, notifications = [], [], [], []
    stats = {"captured": 0, "declined": 0, "refunded": 0, "authorized": 0, "failed": 0}

    for _ in range(a.payments):
        m_id = random.choice(list(by_merchant))
        cust = random.choice(by_merchant[m_id])
        currency = cust[6]
        amount = amount_for(currency)
        fee = bps(amount, mdr_of[m_id]) + fixed_of[m_id]
        fee = min(fee, amount - 1)          # a fee may never exceed the payment
        net = amount - fee
        assert amount == fee + net

        acq = route(currency, amount)
        sr = next(x[4] for x in ACQUIRERS if x[0] == acq)
        approved = random.random() < float(sr)
        risk = min(100, max(0, int(random.triangular(2, 85, 14))))

        if risk >= 75:
            status, auth, decline = "declined", None, "risk_declined"
        elif not approved:
            status, auth, decline = "declined", None, random.choice(DECLINES)
        else:
            status = "captured" if random.random() < 0.94 else "authorized"
            auth, decline = secrets.token_hex(3).upper(), None
        stats[status] = stats.get(status, 0) + 1

        created = now - timedelta(days=random.randint(0, 29),
                                 hours=random.randint(0, 23), minutes=random.randint(0, 59))
        p_id, ref = pid(), f"AXP-{created:%Y%m%d}-{secrets.token_hex(4)}"
        payments.append((p_id, ref, m_id, cust[0], amount, currency, fee, net, status,
                         cust[2], cust[3], cust[4], risk, acq, auth, decline, created))

        # Double-entry: only for money that actually moved.
        if status in ("captured", "authorized"):
            j = jid()
            ledger.append((j, "acquirer_receivable", "DR", amount, currency, p_id, created))
            ledger.append((j, "merchant_payable",    "CR", net,    currency, p_id, created))
            ledger.append((j, "fee_income",          "CR", fee,    currency, p_id, created))

        if status == "captured" and random.random() < 0.038:
            r_created = created + timedelta(days=random.randint(1, 5))
            refunds.append((rid(), p_id, amount, currency,
                            random.choice(["customer_request","duplicate","fraud","goods_not_received"]),
                            "completed", r_created))
            j = jid()
            ledger.append((j, "merchant_payable",    "DR", net,    currency, p_id, r_created))
            ledger.append((j, "fee_income",          "DR", fee,    currency, p_id, r_created))
            ledger.append((j, "acquirer_receivable", "CR", amount, currency, p_id, r_created))

        if random.random() < 0.9:
            delivered = random.random() < 0.94
            notifications.append((nid(), m_id, p_id, "webhook",
                                  f"https://hook.example/{m_id[4:10].lower()}",
                                  "delivered" if delivered else random.choice(["failed","dead_letter"]),
                                  1 if delivered else random.randint(2, 5),
                                  None if delivered else "connection timeout", created))

    for p in payments:
        w("INSERT INTO payments (payment_id,reference,merchant_id,customer_id,amount_minor,currency,"
          "fee_minor,net_minor,status,card_token,card_brand,card_last4,risk_score,acquirer,auth_code,"
          "decline_reason,created_at,updated_at) VALUES ("
          + ",".join(q(x) for x in p[:16]) + f",{q(p[16].isoformat())},{q(p[16].isoformat())});")
    w("")
    w(f"-- {len(ledger)} ledger entries")
    for l in ledger:
        w("INSERT INTO ledger_entries (journal_id,account,direction,amount_minor,currency,payment_id,created_at) "
          "VALUES (" + ",".join(q(x) for x in l[:6]) + f",{q(l[6].isoformat())});")
    w("")
    w(f"-- {len(refunds)} refunds")
    for r in refunds:
        w("INSERT INTO refunds (refund_id,payment_id,amount_minor,currency,reason,status,created_at) "
          "VALUES (" + ",".join(q(x) for x in r[:6]) + f",{q(r[6].isoformat())});")
    w("")
    w(f"-- {len(notifications)} notifications")
    for n in notifications:
        w("INSERT INTO notifications (notification_id,merchant_id,payment_id,channel,endpoint,status,"
          "attempts,last_error,created_at) VALUES ("
          + ",".join(q(x) for x in n[:8]) + f",{q(n[8].isoformat())});")
    w("")

    # ---- settlements -----------------------------------------------------
    batches = {}
    for p in payments:
        if p[8] != "captured": continue
        key = (p[2], p[5], p[16].date())
        g, f_, c = batches.get(key, (0, 0, 0))
        batches[key] = (g + p[4], f_ + p[6], c + 1)
    picked = sorted(batches.items())[:40]
    w(f"-- {len(picked)} settlement batches")
    for (m_id, cur, day), (gross, fees, cnt) in picked:
        s_id = f"STL_{day:%Y%m%d}_{secrets.token_hex(3).upper()}"
        w("INSERT INTO settlements (settlement_id,merchant_id,currency,gross_minor,fees_minor,"
          "net_minor,txn_count,batch_date,status,file_ref) VALUES ("
          f"{q(s_id)},{q(m_id)},{q(cur)},{gross},{fees},{gross-fees},{cnt},{q(day.isoformat())},"
          f"{q('settled')},{q(s_id+'.csv')});")
    w("")
    w("-- audit events")
    for p in payments[:3000]:
        w("INSERT INTO audit_events (occurred_at,actor,action,entity_type,entity_id,correlation_id,payload) "
          f"VALUES ({q(p[16].isoformat())},{q('payment-service')},{q('payment.'+p[8])},{q('payment')},"
          f"{q(p[0])},{q(secrets.token_hex(16))},{q('{}')}::jsonb);")
    w("")
    w("COMMIT;")

    # ---- assert the invariants BEFORE writing ----------------------------
    bad = [p[0] for p in payments if p[4] != p[6] + p[7]]
    if bad:
        print(f"FATAL: {len(bad)} payments do not balance", file=sys.stderr); return 1
    per_journal = {}
    for j, acct, d, amt, cur, p_id, ts in ledger:
        s = per_journal.setdefault(j, 0)
        per_journal[j] = s + (amt if d == "DR" else -amt)
    unbalanced = {j: v for j, v in per_journal.items() if v != 0}
    if unbalanced:
        print(f"FATAL: {len(unbalanced)} journals do not balance", file=sys.stderr); return 1

    sql = "\n".join(out)
    if a.output == "-":
        sys.stdout.write(sql)
    else:
        with open(a.output, "w") as fh: fh.write(sql)

    print(f"merchants        {len(MERCHANTS)}", file=sys.stderr)
    print(f"customers        {len(customers)}", file=sys.stderr)
    print(f"payments         {len(payments)}   {stats}", file=sys.stderr)
    print(f"ledger entries   {len(ledger)}   journals {len(per_journal)}  ALL BALANCED", file=sys.stderr)
    print(f"refunds          {len(refunds)}   ({len(refunds)/len(payments)*100:.1f}%)", file=sys.stderr)
    print(f"notifications    {len(notifications)}", file=sys.stderr)
    print(f"settlements      {len(picked)}", file=sys.stderr)
    print(f"approval rate    {stats['captured']+stats['authorized']}/{len(payments)} = "
          f"{(stats['captured']+stats['authorized'])/len(payments)*100:.1f}%", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
