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
            <footer className="w-full border-t border-border mt-20 bg-card/50">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {/* Brand & Description */}
                        <div className="flex flex-col gap-4">
                            <div className="font-black text-2xl tracking-tighter font-serif">
                                ZeroEcho<span className="text-primary">.</span>Daily
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs font-sans">
                                Curated high-importance news from around the world, delivered without the noise.
                            </p>
                        </div>

                        {/* Connect */}
                        <div className="flex flex-col gap-4 items-start">
                            <h4 className="font-bold uppercase tracking-widest text-sm font-sans">Connect</h4>
                            <button
                                onClick={() => setIsContactModalOpen(true)}
                                className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-full hover:bg-primary/90 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                            >
                                <Mail className="w-4 h-4" /> Send us a message
                            </button>
                        </div>

                        {/* Legal */}
                        <div className="flex flex-col gap-4 md:text-right">
                            <h4 className="font-bold uppercase tracking-widest text-sm font-sans">Legal</h4>
                            <div className="flex flex-col gap-2 md:items-end">
                                <button
                                    onClick={() => openLegalModal('disclaimer')}
                                    className="text-muted-foreground hover:text-primary transition-colors text-sm text-left md:text-right"
                                >
                                    Legal Notice
                                </button>
                                <button
                                    onClick={() => openLegalModal('privacy')}
                                    className="text-muted-foreground hover:text-primary transition-colors text-sm text-left md:text-right"
                                >
                                    Privacy Policy
                                </button>
                                <button
                                    onClick={() => openLegalModal('terms')}
                                    className="text-muted-foreground hover:text-primary transition-colors text-sm text-left md:text-right"
                                >
                                    Terms of Service
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="mt-12 pt-8 border-t border-border/50 text-center">
                        <p className="text-xs text-muted-foreground">
                            © {new Date().getFullYear()} ZeroEchoDaily.com. All rights reserved.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
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
