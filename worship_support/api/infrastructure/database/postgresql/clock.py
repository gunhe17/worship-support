from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa


# #
# clock

class Clock:
    @classmethod
    async def now(cls, *, session) -> datetime:
        return (
            await session.execute(sa.select(sa.func.now()))
        ).scalar_one()
