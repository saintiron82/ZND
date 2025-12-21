import re
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class Processor:
    def process(self, data: Dict) -> Dict:
        return data

class TextNormalizer(Processor):
    def process(self, data: Dict) -> Dict:
        if not data:
            return data
            
        for key, value in data.items():
            if isinstance(value, str):
                # Remove excessive whitespace
                value = re.sub(r'\s+', ' ', value).strip()
                # Fix common encoding issues if any (basic example)
                value = value.replace('\xa0', ' ')
                data[key] = value
        return data

class NoiseRemover(Processor):
    def process(self, data: Dict) -> Dict:
        # This is usually done at the HTML level before extraction, 
        # but can also filter out known bad patterns in extracted text.
        # For now, we'll keep it simple or use it to filter short content.
        if not data:
            return data
            
        text = data.get('text', '')
        if text and len(text) < 50:
            logger.info("Content too short, marking as potentially invalid.")
            data['is_short'] = True
            
        return data

class CompositeProcessor(Processor):
    def __init__(self):
        self.processors = [
            TextNormalizer(),
            NoiseRemover()
        ]

    def process(self, data: Dict) -> Dict:
        for p in self.processors:
            data = p.process(data)
        return data
