'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
            <footer className="w-full border-t border-border mt-12 md:mt-20 bg-card/50">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
                        {/* Brand & Description */}
                        <div className="flex flex-col gap-2 md:gap-4">
                            <div className="font-black text-xl md:text-2xl tracking-tighter font-serif">
                                ZeroEcho<span className="text-teal-500">.</span>Daily
                            </div>
                            <p className="text-muted-foreground text-xs md:text-sm leading-relaxed max-w-xs font-sans">
                                Curated high-importance news from around the world, delivered without the echo.
                            </p>
                        </div>

                        {/* Connect & Legal - 2 column grid on mobile, stays in 3-col grid on desktop */}
                        <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4 md:gap-6 md:grid-cols-2">
                            {/* Connect */}
                            <div className="flex flex-col gap-2 md:gap-3">
                                <h4 className="font-bold uppercase tracking-widest text-[10px] md:text-xs font-sans">Connect</h4>
                                <button
                                    onClick={() => setIsContactModalOpen(true)}
                                    className="px-2.5 py-1.5 md:px-3 md:py-2 bg-teal-500 hover:bg-teal-600 text-white text-[10px] md:text-xs font-bold rounded-full transition-all shadow-sm hover:shadow-md flex items-center gap-1 w-fit"
                                >
                                    <Mail className="w-3 h-3 md:w-3.5 md:h-3.5" /> Message
                                </button>
                            </div>

                            {/* Legal */}
                            <div className="flex flex-col gap-2 md:gap-3">
                                <h4 className="font-bold uppercase tracking-widest text-[10px] md:text-xs font-sans">Legal</h4>
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => openLegalModal('disclaimer')}
                                        className="text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-[10px] md:text-xs text-left"
                                    >
                                        Legal Notice
                                    </button>
                                    <button
                                        onClick={() => openLegalModal('privacy')}
                                        className="text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-[10px] md:text-xs text-left"
                                    >
                                        Privacy
                                    </button>
                                    <button
                                        onClick={() => openLegalModal('terms')}
                                        className="text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-[10px] md:text-xs text-left"
                                    >
                                        Terms
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="mt-6 md:mt-12 pt-4 md:pt-8 border-t border-border/50 text-center">
                        <p className="text-[10px] md:text-xs text-muted-foreground">
                            © {new Date().getFullYear()} ZeroEchoDaily.com. All rights reserved.
                        </p>
                        <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
                            ZeroEcho.Daily is published by ZeroEchoDaily.com.
                        </p>
                    </div>
                </div>
            </footer>

            {/* Modals rendered via Portal to body */}
            {renderModals()}
        </>
    );
}
