import unittest
from datetime import datetime, timezone, timedelta
from crawler import is_recent
import time

class TestAgeFilter(unittest.TestCase):
    def test_recent_date(self):
        now = datetime.now(timezone.utc)
        self.assertTrue(is_recent(now))
        self.assertTrue(is_recent(now - timedelta(days=2)))
        self.assertTrue(is_recent(now - timedelta(days=3))) # Boundary check - exact 3 days might depend on seconds, but roughly true

    def test_old_date(self):
        now = datetime.now(timezone.utc)
        self.assertFalse(is_recent(now - timedelta(days=4)))
        self.assertFalse(is_recent(now - timedelta(days=365)))

    def test_struct_time(self):
        now = time.time()
        # 2 days ago
        recent_struct = time.gmtime(now - (2 * 86400))
        self.assertTrue(is_recent(recent_struct))
        
        # 5 days ago
        old_struct = time.gmtime(now - (5 * 86400))
        self.assertFalse(is_recent(old_struct))

    def test_naive_datetime(self):
        # Naive datetime is treated as UTC in our logic logic or error out?
        # Logic says: if date_obj.tzinfo is None: date_obj = date_obj.replace(tzinfo=timezone.utc)
        now = datetime.utcnow()
        self.assertTrue(is_recent(now)) # Recent naive
        self.assertFalse(is_recent(now - timedelta(days=5))) # Old naive

    def test_none(self):
        self.assertTrue(is_recent(None))

if __name__ == '__main__':
    unittest.main()
