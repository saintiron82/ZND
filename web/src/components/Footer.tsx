'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import ContactModal from './ContactModal';
import LegalModal from './LegalModal';

type LegalDocumentType = 'terms' | 'privacy' | 'disclaimer';

export default function Footer() {
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
    const [initialLegalDocument, setInitialLegalDocument] = useState<LegalDocumentType | undefined>(undefined);

    const openLegalModal = (docType?: LegalDocumentType) => {
        setInitialLegalDocument(docType);
        setIsLegalModalOpen(true);
    };

    // 모달을 body 레벨에 렌더링하기 위한 Portal 컴포넌트
    const renderModals = () => {
        if (typeof window === 'undefined') return null;

        return createPortal(
            <>
                {/* Contact Modal */}
                <ContactModal
                    isOpen={isContactModalOpen}
                    onClose={() => setIsContactModalOpen(false)}
                />

                {/* Legal Modal */}
                <LegalModal
                    isOpen={isLegalModalOpen}
                    onClose={() => setIsLegalModalOpen(false)}
                    initialDocument={initialLegalDocument}
                />
            </>,
            document.body
        );
    };

    return (
        <>
            <footer className="w-full border-t border-border bg-card/50">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">

                    {/* Row 1: Brand & Logo (side by side) */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex flex-col gap-2 md:gap-3">
                            <div className="font-black text-xl md:text-2xl tracking-tighter font-serif">
                                <span className="text-teal-500">Z</span>eroEcho<span className="text-teal-500">.</span>Daily
                            </div>
                            <p className="text-muted-foreground text-xs md:text-sm leading-relaxed max-w-xs font-sans">
                                전 세계의 핵심 뉴스를 엄선하여 에코 없이 전달합니다.
                            </p>
                        </div>
                        <Link href="/" className="block flex-shrink-0">
                            <Image
                                src="/logo.png"
                                alt="ZED"
                                width={80}
                                height={80}
                                className="object-contain opacity-70 hover:opacity-100 transition-opacity"
                                style={{ width: 'auto', height: 'auto', maxHeight: '50px' }}
                            />
                        </Link>
                    </div>

                    {/* Row 2: 2-column layout (Message | Legal) */}
                    <div className="grid grid-cols-2 gap-6 md:gap-12">
                        {/* Column 1: Send Message Button */}
                        <div className="flex items-center justify-center">
                            <button
                                onClick={() => setIsContactModalOpen(true)}
                                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-[10px] md:text-xs font-bold rounded-full transition-all shadow-sm hover:shadow-md flex items-center gap-1.5"
                            >
                                <Mail className="w-3 h-3 md:w-4 md:h-4" />
                                <span>Send Message</span>
                            </button>
                        </div>

                        {/* Column 2: Legal */}
                        <div className="flex flex-col items-center gap-2">
                            <h4 className="font-bold uppercase tracking-widest text-[10px] md:text-xs font-sans text-muted-foreground">Legal</h4>
                            <div className="flex flex-col items-center gap-1">
                                <button
                                    onClick={() => openLegalModal('disclaimer')}
                                    className="text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-[10px] md:text-xs"
                                >
                                    면책조항
                                </button>
                                <button
                                    onClick={() => openLegalModal('privacy')}
                                    className="text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-[10px] md:text-xs"
                                >
                                    개인정보처리방침
                                </button>
                                <button
                                    onClick={() => openLegalModal('terms')}
                                    className="text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-[10px] md:text-xs"
                                >
                                    이용약관
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="mt-4 pt-4 border-t border-border/50 text-center">
                        <p className="text-[10px] md:text-xs text-muted-foreground">
                            © {new Date().getFullYear()} ZeroEchoDaily.com. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
            {/* 하단 네비게이션 바 공간 확보 (모바일) */}
            <div className="h-16 lg:hidden" />

            {/* Modals rendered via Portal to body */}
            {renderModals()}
        </>
    );
}
