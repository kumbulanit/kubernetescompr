"""Money handling.

RULE, stated once on Day 1 and never broken: money is an integer in MINOR units
plus an ISO-4217 currency code. There is no floating point anywhere in the money
path, in any service, in any fixture.

    amount_minor=129900, currency="ZAR"   ->   R1,299.00

Floating point cannot represent 0.1 exactly. In a ledger that must balance to
zero across ten thousand entries, that is not a rounding curiosity — it is an
audit finding.
"""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Dict

# ISO 4217 minor-unit exponents for the currencies AxisPay supports.
EXPONENTS: Dict[str, int] = {
    "ZAR": 2, "USD": 2, "EUR": 2, "GBP": 2, "NGN": 2, "KES": 2, "BWP": 2,
    "JPY": 0,   # included deliberately: a zero-decimal currency breaks naive code
}

SYMBOLS: Dict[str, str] = {
    "ZAR": "R", "USD": "$", "EUR": "€", "GBP": "£",
    "NGN": "₦", "KES": "KSh", "BWP": "P", "JPY": "¥",
}


@dataclass(frozen=True)
class Money:
    amount_minor: int
    currency: str

    def __post_init__(self) -> None:
        if not isinstance(self.amount_minor, int):
            raise TypeError("amount_minor must be an int in minor units, never a float")
        if self.currency.upper() not in EXPONENTS:
            raise ValueError(f"unsupported currency: {self.currency}")

    @property
    def exponent(self) -> int:
        return EXPONENTS[self.currency.upper()]

    def __str__(self) -> str:
        return format_minor(self.amount_minor, self.currency)

    def basis_points(self, bps: int) -> "Money":
        """Fee calculation. Integer maths, banker-safe rounding, no float."""
        fee = (Decimal(self.amount_minor) * Decimal(bps) / Decimal(10_000)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
        return Money(int(fee), self.currency)

    def __add__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(f"cannot add {self.currency} to {other.currency}")
        return Money(self.amount_minor + other.amount_minor, self.currency)

    def __sub__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(f"cannot subtract {other.currency} from {self.currency}")
        return Money(self.amount_minor - other.amount_minor, self.currency)


def format_minor(amount_minor: int, currency: str) -> str:
    """129900, 'ZAR' -> 'R1,299.00'"""
    cur = currency.upper()
    exp = EXPONENTS.get(cur, 2)
    sym = SYMBOLS.get(cur, cur + " ")
    if exp == 0:
        return f"{sym}{amount_minor:,}"
    major, minor = divmod(abs(amount_minor), 10 ** exp)
    sign = "-" if amount_minor < 0 else ""
    return f"{sign}{sym}{major:,}.{minor:0{exp}d}"


def parse_major_to_minor(amount_major: str, currency: str) -> int:
    """'1299.00', 'ZAR' -> 129900.  Accepts a string, never a float."""
    exp = EXPONENTS.get(currency.upper(), 2)
    return int((Decimal(str(amount_major)) * (10 ** exp)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
