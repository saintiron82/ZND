/**
 * File-based Feedback Store Implementation
 * 
 * JSON 파일을 사용한 피드백 저장소 구현
 * - 날짜별 폴더 구조: supplier/data/feedback/{date}/
 * - 개별 투표 기록: votes.json
 * - 집계 데이터: aggregate.json
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    IFeedbackStore,
    FeedbackRecord,
    FeedbackAggregate,
    SubmitFeedbackRequest,
    SubmitFeedbackResponse,
} from './types';

export class FileFeedbackStore implements IFeedbackStore {
    private basePath: string;

    constructor(basePath?: string) {
        // 기본 경로: supplier/data/feedback
        this.basePath = basePath || path.join(process.cwd(), '..', 'supplier', 'data', 'feedback');
    }

    /**
     * 날짜별 디렉토리 경로 반환
     */
    private getDateDir(date: string): string {
        return path.join(this.basePath, date);
    }

    /**
     * 투표 기록 파일 경로
     */
    private getVotesPath(date: string): string {
        return path.join(this.getDateDir(date), 'votes.json');
    }

    /**
     * 집계 데이터 파일 경로
     */
    private getAggregatePath(date: string): string {
        return path.join(this.getDateDir(date), 'aggregate.json');
    }

    /**
     * 디렉토리 생성 (없으면)
     */
    private ensureDir(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * 투표 기록 로드
     */
    private loadVotes(date: string): FeedbackRecord[] {
        const votesPath = this.getVotesPath(date);
        if (!fs.existsSync(votesPath)) {
            return [];
        }
        try {
            const data = fs.readFileSync(votesPath, 'utf-8');
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    /**
     * 투표 기록 저장
     */
    private saveVotes(date: string, votes: FeedbackRecord[]): void {
        this.ensureDir(this.getDateDir(date));
        const votesPath = this.getVotesPath(date);
        fs.writeFileSync(votesPath, JSON.stringify(votes, null, 2), 'utf-8');
    }

    /**
     * 집계 데이터 로드
     */
    private loadAggregates(date: string): Map<string, FeedbackAggregate> {
        const aggPath = this.getAggregatePath(date);
        if (!fs.existsSync(aggPath)) {
            return new Map();
        }
        try {
            const data = fs.readFileSync(aggPath, 'utf-8');
            const arr: FeedbackAggregate[] = JSON.parse(data);
            const map = new Map<string, FeedbackAggregate>();
            arr.forEach(agg => map.set(agg.articleId, agg));
            return map;
        } catch {
            return new Map();
        }
    }

    /**
     * 집계 데이터 저장
     */
    private saveAggregates(date: string, aggregates: Map<string, FeedbackAggregate>): void {
        this.ensureDir(this.getDateDir(date));
        const aggPath = this.getAggregatePath(date);
        const arr = Array.from(aggregates.values());
        fs.writeFileSync(aggPath, JSON.stringify(arr, null, 2), 'utf-8');
    }

    /**
     * 피드백 제출
     */
    async submitFeedback(request: SubmitFeedbackRequest): Promise<SubmitFeedbackResponse> {
        const { articleId, date, vote, clientId } = request;

        // 중복 투표 확인
        const alreadyVoted = await this.hasVoted(articleId, date, clientId);
        if (alreadyVoted) {
            const aggregate = await this.getAggregate(articleId, date);
            return {
                success: false,
                message: '이미 이 기사에 투표하셨습니다.',
                aggregate: aggregate || undefined,
                alreadyVoted: true,
            };
        }

        // 새 투표 기록 추가
        const votes = this.loadVotes(date);
        const newRecord: FeedbackRecord = {
            articleId,
            date,
            vote,
            clientId,
            createdAt: new Date().toISOString(),
        };
        votes.push(newRecord);
        this.saveVotes(date, votes);

        // 집계 업데이트
        const aggregates = this.loadAggregates(date);
        let aggregate = aggregates.get(articleId);

        if (!aggregate) {
            aggregate = {
                articleId,
                date,
                votes: { lower: 0, agree: 0, higher: 0 },
                totalVotes: 0,
                lastUpdated: new Date().toISOString(),
            };
        }

        aggregate.votes[vote]++;
        aggregate.totalVotes++;
        aggregate.lastUpdated = new Date().toISOString();

        aggregates.set(articleId, aggregate);
        this.saveAggregates(date, aggregates);

        return {
            success: true,
            message: '피드백이 성공적으로 제출되었습니다.',
            aggregate,
            alreadyVoted: false,
        };
    }

    /**
     * 특정 기사의 피드백 집계 조회
     */
    async getAggregate(articleId: string, date: string): Promise<FeedbackAggregate | null> {
        const aggregates = this.loadAggregates(date);
        return aggregates.get(articleId) || null;
    }

    /**
     * 특정 날짜의 모든 기사 피드백 집계 조회
     */
    async getAggregatesByDate(date: string): Promise<Map<string, FeedbackAggregate>> {
        return this.loadAggregates(date);
    }

    /**
     * 사용자가 이미 투표했는지 확인
     */
    async hasVoted(articleId: string, date: string, clientId: string): Promise<boolean> {
        const votes = this.loadVotes(date);
        return votes.some(v => v.articleId === articleId && v.clientId === clientId);
    }
}
