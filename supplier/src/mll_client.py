import os
import requests
import json
import time

class MLLClient:
    def __init__(self):
        # Default to localhost:5000 as per user example, but allow env override
        self.api_url = os.getenv("MLL_API_URL", "http://localhost:5000")
        self.api_token = os.getenv("MLL_API_TOKEN")
        self.project_key = os.getenv("MLL_PROJECT_KEY", "news_factory")
        self.username = os.getenv("MLL_USERNAME", "external_bot_client")

    def login(self):
        """
        Logs in to MLL backend to retrieve access token.
        """
        url = f"{self.api_url}/api/user/login"
        payload = {"user_name": self.username}
        
        print(f"🔑 로그인 시도: {self.username} -> {url}")
        try:
            resp = requests.post(url, json=payload, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            
            if data.get("success"):
                self.api_token = data.get("access_token")
                print(f"✅ 로그인 성공! 토큰 획득 완료.")
                return True
            else:
                print(f"❌ 로그인 실패: {data.get('message')}")
                return False
        except Exception as e:
            print(f"❌ 로그인 중 오류 발생: {e}")
            return False

    def analyze_text(self, text):
        """
        Sends text to MLL engine for analysis.
        Auto-logins if token is missing.
        """
        if not self.api_token:
            if not self.login():
                return None

        url = f"{self.api_url}/api/sandbox/chat"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        # User protocol uses "ASK" key
        payload = {
            "project_key": self.project_key,
            "ASK": text
        }

        print(f"\n🚀 [MLL Request] Sending request to: {url}")
        print(f"📝 [MLL Request] Payload (Preview): {text[:200]}...")

        # Fail fast mode: No retries, raise exceptions.
        print(f"\n🚀 [MLL Request] Sending request to: {url}")
        print(f"� [MLL Request] Payload (Preview): {text[:200]}...")
        
        try:
            print(f"⏳ [MLL Request] Waiting for response...")
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            print(f"📥 [MLL Response] Status Code: {response.status_code}")
            
            # Print raw response text for debugging if status is not 200 or just always for now since we are debugging
            # print(f"DEBUG: Raw Response Text: {response.text[:500]}...") 

            response.raise_for_status()
            data = response.json()
            
            # Debug: Print the keys of the received JSON
            print(f"🔍 [MLL Response Keys] {list(data.keys())}")

            if data.get("success"):
                print(f"✅ [MLL Response] Success flag is True.")
                
                # Adapt to actual API response structure
                # Priority 1: Direct 'response' key (seen in logs)
                if "response" in data:
                    final_text = data["response"]
                # Priority 2: 'data' -> 'final_text' (legacy/expected structure)
                elif "data" in data and "final_text" in data["data"]:
                    final_text = data["data"]["final_text"]
                else:
                    print(f"❌ [MLL Response Error] Could not find 'response' or 'data.final_text' in response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                    raise KeyError("Response JSON missing expected content fields")

                try:
                    parsed_result = None
                    if isinstance(final_text, dict):
                        parsed_result = final_text
                    else:
                        parsed_result = json.loads(final_text)
                    
                    print(f"📦 [MLL Response] Parsed Content:\n{json.dumps(parsed_result, indent=2, ensure_ascii=False)}")
                    return parsed_result
                except json.JSONDecodeError as e:
                    print(f"⚠️ [MLL Response] JSON Decode Error: {e}")
                    print(f"Raw text was: {final_text}")
                    raise e
            else:
                print(f"❌ [MLL Response] API reported failure: {data.get('message')}")
                print(f"Full Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
                raise Exception(f"API Error: {data.get('message')}")

        except Exception as e:
            print(f"❌ [MLL Request] Critical Failure: {e}")
            raise e # Re-raise to stop the script
