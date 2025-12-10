/**
 * Feedback Store Factory & Exports
 * 
 * 저장소 인스턴스 생성 및 모듈 export
 * 나중에 StoreType만 변경하면 저장소 교체 가능
 */

import { IFeedbackStore, StoreType } from './types';
import { FileFeedbackStore } from './file-store';

// Re-export types
export * from './types';
export { FileFeedbackStore } from './file-store';

/**
 * 현재 사용할 저장소 타입 (설정으로 변경 가능)
 * 추후 환경변수나 config에서 읽어올 수 있음
 */
const CURRENT_STORE_TYPE: StoreType = 'file';

/**
 * 저장소 팩토리 함수
 * StoreType에 따라 적절한 저장소 인스턴스 반환
 */
export function createFeedbackStore(type?: StoreType): IFeedbackStore {
    const storeType = type || CURRENT_STORE_TYPE;

    switch (storeType) {
        case 'file':
            return new FileFeedbackStore();

        case 'firebase':
            // TODO: Firebase 구현 시 추가
            // return new FirebaseFeedbackStore();
            throw new Error('Firebase store not implemented yet');

        case 'supabase':
            // TODO: Supabase 구현 시 추가
            // return new SupabaseFeedbackStore();
            throw new Error('Supabase store not implemented yet');

        default:
            throw new Error(`Unknown store type: ${storeType}`);
    }
}

/**
 * 기본 저장소 싱글톤 인스턴스
 */
let defaultStore: IFeedbackStore | null = null;

export function getDefaultFeedbackStore(): IFeedbackStore {
    if (!defaultStore) {
        defaultStore = createFeedbackStore();
    }
    return defaultStore;
}
