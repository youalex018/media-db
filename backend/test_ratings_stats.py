#!/usr/bin/env python3
"""
Integration tests for the ratings stats endpoint.
Run with: python test_ratings_stats.py

Expected output: standard unittest summary with 1 passing test.
"""

import json
import os
import tempfile
import unittest
from pathlib import Path

try:
    from fastapi.testclient import TestClient  # type: ignore[import-not-found]
except ModuleNotFoundError:  # pragma: no cover
    from starlette.testclient import TestClient  # type: ignore[import-not-found]

from app.auth import get_current_user
from app.main import create_app


class RatingsStatsEndpointTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.script_path = Path(self.temp_dir.name) / "ratings_stats_stub.py"
        self.script_path.write_text(
            "\n".join(
                [
                    "import json",
                    "import sys",
                    "data = json.load(sys.stdin)",
                    "stats = {}",
                    "overall_sum = 0",
                    "overall_count = 0",
                    "for item in data:",
                    "    key = item.get('type')",
                    "    rating = float(item.get('rating', 0))",
                    "    entry = stats.setdefault(key, {'sum': 0.0, 'count': 0})",
                    "    entry['sum'] += rating",
                    "    entry['count'] += 1",
                    "    overall_sum += rating",
                    "    overall_count += 1",
                    "result = {'types': {}, 'overall': {'average_rating': (overall_sum / overall_count) if overall_count else 0.0, 'count': overall_count}}",
                    "for key, entry in stats.items():",
                    "    avg = entry['sum'] / entry['count'] if entry['count'] else 0.0",
                    "    result['types'][key] = {'average_rating': avg, 'count': entry['count']}",
                    "print(json.dumps(result))",
                ]
            )
        )
        self.env_backup = dict(os.environ)
        os.environ["RATINGS_STATS_BIN"] = str(self.script_path)
        os.environ["SUPABASE_URL"] = os.environ.get(
            "SUPABASE_URL", "https://test-project.supabase.co"
        )
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = os.environ.get(
            "SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key"
        )
        os.environ["SUPABASE_ANON_KEY"] = os.environ.get(
            "SUPABASE_ANON_KEY", "test-anon-key"
        )
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: {"user_id": "test-user"}
        self.client = TestClient(app)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.env_backup)
        self.temp_dir.cleanup()

    def test_ratings_stats_endpoint(self):
        payload = [
            {"type": "movie", "rating": 90},
            {"type": "movie", "rating": 70},
            {"type": "book", "rating": 80},
        ]
        response = self.client.post("/api/ratings/stats", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("stats", data)
        stats = data["stats"]
        self.assertEqual(stats["overall"]["count"], 3)
        self.assertIn("movie", stats["types"])
        self.assertIn("book", stats["types"])


if __name__ == "__main__":
    unittest.main()
