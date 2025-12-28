import json
import logging
from abc import ABC, abstractmethod
from bs4 import BeautifulSoup
from newspaper import Article

logger = logging.getLogger(__name__)

class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, html: str, url: str) -> dict:
        """Extracts data from HTML."""
        pass

class JsonLdExtractor(BaseExtractor):
    def extract(self, html: str, url: str) -> dict:
        soup = BeautifulSoup(html, 'html.parser')
        data = {}
        
        # Find all JSON-LD scripts
        scripts = soup.find_all('script', type='application/ld+json')
        for script in scripts:
            try:
                content = script.string
                if not content:
                    continue
                json_data = json.loads(content)
                
                # Handle list of objects
                if isinstance(json_data, list):
                    for item in json_data:
                        if self._is_news_article(item):
                            data.update(self._parse_schema(item))
                elif isinstance(json_data, dict):
                    if self._is_news_article(json_data):
                        data.update(self._parse_schema(json_data))
                        
            except Exception as e:
                logger.debug(f"JSON-LD parsing error: {e}")
                continue
                
        return data

    def _is_news_article(self, item):
        dtype = item.get('@type')
        if isinstance(dtype, list):
            return any(t in ['NewsArticle', 'Article', 'BlogPosting'] for t in dtype)
        return dtype in ['NewsArticle', 'Article', 'BlogPosting']

    def _parse_schema(self, item):
        return {
            'title': item.get('headline') or item.get('name'),
            'description': item.get('description'), # [MODIFIED] summary -> description
            'published_at': item.get('datePublished'),
            'modified_at': item.get('dateModified'),
            'author': self._parse_author(item.get('author')),
            'image': self._parse_image(item.get('image'))
        }

    # ... (중략) ...

class OpenGraphExtractor(BaseExtractor):
    def extract(self, html: str, url: str) -> dict:
        soup = BeautifulSoup(html, 'html.parser')
        data = {}
        
        og_title = soup.find('meta', property='og:title')
        if og_title: data['title'] = og_title.get('content')
        
        og_desc = soup.find('meta', property='og:description')
        if og_desc: data['description'] = og_desc.get('content') # [MODIFIED] summary -> description
        
        og_image = soup.find('meta', property='og:image')
        if og_image: data['image'] = og_image.get('content')
        
        return data

class ContentExtractor(BaseExtractor):
    def extract(self, html: str, url: str) -> dict:
        try:
            article = Article(url)
            article.set_html(html)
            article.parse()
            return {
                'text': article.text,
                'title': article.title, # Fallback title
                'image': article.top_image,
                'published_at': article.publish_date
            }
        except Exception as e:
            logger.error(f"ContentExtractor error: {e}")
            return {}

class CompositeExtractor(BaseExtractor):
    def __init__(self):
        self.extractors = [
            JsonLdExtractor(),
            OpenGraphExtractor(),
            ContentExtractor()
        ]

    def extract(self, html: str, url: str) -> dict:
        final_data = {}
        
        for extractor in self.extractors:
            try:
                data = extractor.extract(html, url)
                # Merge data, keeping existing non-empty values (priority to earlier extractors)
                for k, v in data.items():
                    if v and k not in final_data:
                        final_data[k] = v
                    # Special case for text: ContentExtractor is the main source for 'text'
                    if k == 'text':
                        final_data[k] = v
            except Exception as e:
                logger.error(f"Extractor {extractor.__class__.__name__} failed: {e}")
                
        return final_data
