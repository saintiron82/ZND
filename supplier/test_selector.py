import requests
from bs4 import BeautifulSoup

url = "https://www.aitimes.com/"
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
response = requests.get(url, headers=headers, verify=False)
soup = BeautifulSoup(response.text, 'html.parser')

selectors = [
    "div.auto-content a",
    "div.item a",
    ".auto-titles"
]

print(f"Testing selectors for {url}")
for sel in selectors:
    elements = soup.select(sel)
    print(f"Selector '{sel}': Found {len(elements)} elements")
    if elements:
        print(f"  First item: {elements[0].text.strip()} -> {elements[0].get('href')}")
        
# Check container of a tags
print("\nChecking container of <a> tags with .auto-titles:")
titles = soup.select(".auto-titles")
for i, title in enumerate(titles[:5]):
    link = title.parent
    if link.name == 'a':
        container = link.parent
        print(f"Item {i}: Container is <{container.name}> with classes: {container.get('class')}")
