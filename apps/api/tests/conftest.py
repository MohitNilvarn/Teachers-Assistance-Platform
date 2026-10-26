from typing import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture(scope="session", autouse=True)
def mock_db_connections():
    """
    Mock the database connection functions to avoid needing a running DB.
    Pattern: patch the functions where they are imported or defined.
    """
    # Create AsyncMocks
    mock_connect_mongo = AsyncMock()
    mock_close_mongo = AsyncMock()
    mock_connect_redis = AsyncMock()
    mock_close_redis = AsyncMock()

    # Patch the functions in app.main where they are used
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.main.connect_to_mongodb", mock_connect_mongo)
        mp.setattr("app.main.close_mongodb_connection", mock_close_mongo)
        mp.setattr("app.main.connect_to_redis", mock_connect_redis)
        mp.setattr("app.main.close_redis_connection", mock_close_redis)
        yield

@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """
    Create a new AsyncClient for the FastAPI app.
    Using ASGITransport is the modern way to test FastAPI/Starlette apps with httpx.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
