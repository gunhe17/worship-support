from functools import wraps
from typing import get_type_hints


def typecheck(func):
    hints = get_type_hints(func)

    @wraps(func)
    def wrapper(*args, **kwargs):
        for name, value in kwargs.items():
            expected = hints.get(name)
            if expected is None:
                continue
            if not isinstance(value, expected):
                raise # TypeError
        return func(*args, **kwargs)

    return wrapper