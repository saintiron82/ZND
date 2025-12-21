import os
import requests
import json
import flask
import time

class MLLClient:
    def __init__(self):
        # Default to localhost:5000 as per user example, but allow env override
        self.api_url = os.getenv("MLL_API_URL", "http://localhost:5000")
        self.fallback_url = "http://localhost:3000"
        self.api_token = os.getenv("MLL_API_TOKEN")
        self.project_key = os.getenv("MLL_PROJECT_KEY", "news_factory")
        self.username = os.getenv("MLL_USERNAME", "external_bot_client")
        
        print(f"✅ [MLL] Client initialized for {self.api_url}")

    def login(self):
        """
        Logs in to MLL backend to retrieve access token.
        """
        url = f"{self.api_url}/api/user/login"
        payload = {"user_name": self.username}
        
        print(f"🔑 로그인 시도: {self.username} -> {url}")
        try:
            try:
                resp = requests.post(url, json=payload, timeout=10)
            except requests.exceptions.ConnectionError:
                if self.api_url != self.fallback_url:
                    print(f"⚠️ [Login] Connection to {self.api_url} failed. Switching to fallback: {self.fallback_url}")
                    self.api_url = self.fallback_url
                    url = f"{self.api_url}/api/user/login"
                    resp = requests.post(url, json=payload, timeout=10)
                else:
                    raise

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

    def analyze_article(self, article_data: dict):
        """
        Sends article data to MLL engine for analysis.
        Input is formatted as a JSON array of article objects matching the MLL Prompt Input Format.
        
        Args:
            article_data: Dict containing 'article_id', 'title', 'text'
            
        Returns:
            Dict containing the analysis result (first item of the response array)
        """
        if not self.api_token:
            if not self.login():
                return None

        # Format input as a JSON array containing one article object
        # Keys match the "Input Format" expected by the pre-recorded prompt
        formatted_input = [{
            "Article_ID": article_data.get('article_id', 'UNKNOWN'),
            "Title": article_data.get('title', 'No Title'),
            "Body": article_data.get('text', '') or article_data.get('Body', '')
        }]
        
        # Strictly just the JSON string
        input_json_str = json.dumps(formatted_input, ensure_ascii=False)
        
        return self._send_request(input_json_str)

    def analyze_text(self, text):
        """
        Legacy wrapper for backward compatibility.
        """
        return self.analyze_article({
            'article_id': 'LEGACY_CALL',
            'title': 'Unknown Title',
            'text': text
        })

    def _send_request(self, text_payload):
        """
        Internal method to send request to MLL.
        """
        url = f"{self.api_url}/api/sandbox/chat"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "project_key": self.project_key,
            "ASK": text_payload
        }

        timeout_seconds = int(os.getenv("MLL_TIMEOUT", 120)) # Increased timeout for full analysis
        start_time = time.time()

        print(f"\n🚀 [MLL Request] Sending request to: {url}")
        print(f"⏱️ [MLL Request] Timeout set to: {timeout_seconds}s")
        
        try:
            print(f"⏳ [MLL Request] Waiting for response...")
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=timeout_seconds)
            except requests.exceptions.ConnectionError:
                if self.api_url != self.fallback_url:
                    print(f"⚠️ [Analyze] Connection to {self.api_url} failed. Switching to fallback: {self.fallback_url}")
                    self.api_url = self.fallback_url
                    
                    if self.login():
                        headers["Authorization"] = f"Bearer {self.api_token}"
                        url = f"{self.api_url}/api/sandbox/chat"
                        print(f"🚀 [MLL Request] Retrying request to: {url}")
                        response = requests.post(url, headers=headers, json=payload, timeout=timeout_seconds)
                    else:
                        raise Exception("Login failed on fallback server")
                else:
                    raise

            elapsed_time = time.time() - start_time
            print(f"📥 [MLL Response] Status Code: {response.status_code} (Took {elapsed_time:.2f}s)")
            
            response.raise_for_status()
            data = response.json()
            
            if data.get("success"):
                if "response" in data:
                    final_text = data["response"]
                elif "data" in data and "final_text" in data["data"]:
                    final_text = data["data"]["final_text"]
                else:
                    raise KeyError("Response JSON missing expected content fields")

                try:
                    # Clean up markdown code blocks if present
                    if isinstance(final_text, str):
                        # Remove markdown code block syntax if present
                        if "```json" in final_text:
                            final_text = final_text.split("```json")[1].split("```")[0]
                        elif "```" in final_text:
                            final_text = final_text.split("```")[1].split("```")[0]
                        final_text = final_text.strip()
                    
                    parsed_result = None
                    if isinstance(final_text, dict):
                        parsed_result = final_text
                    else:
                        parsed_result = json.loads(final_text)
                    
                    # If result is a list (as expected by V0.9), return the first item
                    if isinstance(parsed_result, list) and len(parsed_result) > 0:
                        print(f"📦 [MLL Response] Parsed Array (Returning 1st item).")
                        return parsed_result[0]
                    
                    print(f"📦 [MLL Response] Parsed Object.")
                    return parsed_result
                    
                except json.JSONDecodeError as e:
                    print(f"⚠️ [MLL Response] JSON Decode Error: {e}")
                    print(f"Raw text was: {final_text}")
                    raise e
            else:
                print(f"❌ [MLL Response] API reported failure: {data.get('message')}")
                raise Exception(f"API Error: {data.get('message')}")

        except Exception as e:
            elapsed_time = time.time() - start_time
            print(f"❌ [MLL Request] Critical Failure after {elapsed_time:.2f}s: {e}")
            raise e
