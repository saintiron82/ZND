from src.robots_checker import RobotsChecker

def test_robots():
    checker = RobotsChecker()
    
    # Test cases
    tests = [
        ("https://www.google.com/", True), # Usually allowed
        ("https://www.google.com/search?q=test", False), # Usually disallowed
        ("https://www.naver.com/", True),
        ("https://www.wikipedia.org/", True)
    ]
    
    print("Running RobotsChecker tests...")
    for url, expected in tests:
        result = checker.can_fetch(url)
        status = "✅ PASS" if result == expected else f"❌ FAIL (Expected {expected})"
        print(f"[{status}] {url} -> {result}")

if __name__ == "__main__":
    test_robots()
