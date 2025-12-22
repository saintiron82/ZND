'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Shield, Scale, ChevronLeft } from 'lucide-react';
import legalDocuments from '@/config/legalDocuments.json';

type DocumentType = 'terms' | 'privacy' | 'disclaimer';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialDocument?: DocumentType;
}

interface Section {
    number?: number;
    title?: string;
    content?: string;
    subtitle?: string;
    subsections?: Array<{
        subtitle?: string;
        content?: string;
    }>;
}

interface LegalDocument {
    id: string;
    title: string;
    titleEn: string;
    publisher: string;
    lastUpdated: string;
    sections: Section[];
    footer?: string;
}

const documentIcons = {
    terms: FileText,
    privacy: Shield,
    disclaimer: Scale,
};

const documentKeys: Record<DocumentType, keyof typeof legalDocuments.legal> = {
    terms: 'termsOfService',
    privacy: 'privacyPolicy',
    disclaimer: 'legalDisclaimer',
};

export default function LegalModal({ isOpen, onClose, initialDocument }: LegalModalProps) {
    const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(initialDocument || null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedDocument(initialDocument || null);
        }
    }, [isOpen, initialDocument]);

    if (!isOpen) return null;

    const documents: { type: DocumentType; doc: LegalDocument }[] = [
        { type: 'terms', doc: legalDocuments.legal.termsOfService as LegalDocument },
        { type: 'privacy', doc: legalDocuments.legal.privacyPolicy as LegalDocument },
        { type: 'disclaimer', doc: legalDocuments.legal.legalDisclaimer as LegalDocument },
    ];

    const currentDoc = selectedDocument
        ? legalDocuments.legal[documentKeys[selectedDocument]] as LegalDocument
        : null;

    const renderDocumentList = () => (
        <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
                ZeroEcho Daily 서비스 이용과 관련된 법적 문서입니다.
            </p>
            {documents.map(({ type, doc }) => {
                const Icon = documentIcons[type];
                return (
                    <button
                        key={type}
                        onClick={() => setSelectedDocument(type)}
                        className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
                    >
                        <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm">{doc.title}</h4>
                            <p className="text-xs text-muted-foreground">{doc.titleEn}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {doc.lastUpdated}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    const renderDocumentContent = () => {
        if (!currentDoc) return null;

        return (
            <div className="flex flex-col h-full max-h-[70vh]">
                {/* Document Header */}
                <div className="p-4 border-b border-border bg-accent/30">
                    <button
                        onClick={() => setSelectedDocument(null)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        목록으로
                    </button>
                    <h3 className="font-bold text-lg">{currentDoc.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        발행인: {currentDoc.publisher} | 최종 수정일: {currentDoc.lastUpdated}
                    </p>
                </div>

                {/* Document Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {currentDoc.sections.map((section, idx) => (
                        <div key={idx} className="space-y-2">
                            {section.number && section.title && (
                                <h4 className="font-bold text-sm text-teal-600 dark:text-teal-400">
                                    {section.number}. {section.title}
                                </h4>
                            )}
                            {section.content && (
                                <p className="text-sm text-foreground/90 leading-relaxed">
                                    {section.content}
                                </p>
                            )}
                            {section.subsections && (
                                <ul className="space-y-2 pl-4">
                                    {section.subsections.map((sub, subIdx) => (
                                        <li key={subIdx} className="text-sm text-foreground/80">
                                            {sub.subtitle && (
                                                <span className="font-semibold">{sub.subtitle}: </span>
                                            )}
                                            {sub.content}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}

                    {currentDoc.footer && (
                        <div className="pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground italic">
                                {currentDoc.footer}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="font-bold text-lg font-serif">
                        {selectedDocument ? '법적 문서' : 'Legal Documents'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                {selectedDocument ? renderDocumentContent() : renderDocumentList()}
            </div>
        </div>
    );
}
