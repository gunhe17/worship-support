from __future__ import annotations

from contextlib import asynccontextmanager

from sqlalchemy.exc import DBAPIError, SQLAlchemyError

from worship_support.api.core.exception import ApplicationError as CoreApplicationError
from worship_support.api.infrastructure.database.common.exception import DatabaseError


# #
# session

@asynccontextmanager
async def transactional_session(session_factory):
    session = session_factory()
    try:
        yield session
        await session.commit()
    except CoreApplicationError:
        await session.rollback()
        raise
    except DBAPIError as exc:
        await session.rollback()
        raise DatabaseError(operation="transaction", reason=str(exc.orig).splitlines()[0])
    except SQLAlchemyError as exc:
        await session.rollback()
        raise DatabaseError(operation="transaction", reason=str(exc).splitlines()[0])
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
