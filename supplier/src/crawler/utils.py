import urllib.robotparser
from urllib.parse import urlparse
import requests
import time

class RobotsChecker:
    def __init__(self, user_agent='*'):
        self.user_agent = user_agent
        self.parsers = {} # Cache parsers by domain
        self.last_checked = {} 

    def get_parser(self, url):
        parsed_url = urlparse(url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        if base_url in self.parsers:
            return self.parsers[base_url]
        
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{base_url}/robots.txt")
        
        try:
            # Use requests for better SSL/network handling
            # Set a browser-like User-Agent to avoid being blocked
            headers = {'User-Agent': 'Mozilla/5.0 (compatible; ZNDBot/1.0; +http://example.com/bot)'}
            response = requests.get(f"{base_url}/robots.txt", headers=headers, timeout=10, verify=False) 
            
            if response.status_code == 200:
                rp.parse(response.text.splitlines())
            else:
                # If 404 or other error, usually assume allowed (default state of rp)
                pass
        except Exception as e:
            print(f"⚠️ [RobotsChecker] Failed to fetch robots.txt for {base_url}: {e}")
            pass
            
        self.parsers[base_url] = rp
        return rp

    def can_fetch(self, url):
        try:
            rp = self.get_parser(url)
            return rp.can_fetch(self.user_agent, url)
        except Exception as e:
            print(f"⚠️ [RobotsChecker] Error checking permission for {url}: {e}")
            return True # Default to allow on error
