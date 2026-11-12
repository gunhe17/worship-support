from __future__ import annotations

import asyncio

from worship_support.api.worker.worker import worship_support_worker


# #
# worker

worker = worship_support_worker()


# #
# run

if __name__ == "__main__":
    asyncio.run(worker.run())
