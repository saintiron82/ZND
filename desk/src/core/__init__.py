# -*- coding: utf-8 -*-
"""
Core Module Initialization
새 desk 핵심 모듈
"""
from .article_state import ArticleState, can_transition, VALID_TRANSITIONS
from .firestore_client import FirestoreClient
from .article_manager import ArticleManager
from .db_gateway import DBGateway, get_db_gateway, init_db_gateway
from .article_registry import ArticleRegistry, get_registry, init_registry
from .schema_adapter import SchemaAdapter

__all__ = [
    'ArticleState',
    'can_transition', 
    'VALID_TRANSITIONS',
    'FirestoreClient',
    'ArticleManager',
    'DBGateway',
    'get_db_gateway',
    'init_db_gateway',
    'ArticleRegistry',
    'get_registry',
    'init_registry',
    'SchemaAdapter',
]
