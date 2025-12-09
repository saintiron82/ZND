'use client';

import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import ContactModal from './ContactModal';

export default function Footer() {
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);

    return (
        <footer className="w-full border-t border-border mt-20 bg-card/50">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Brand & Description */}
                    <div className="flex flex-col gap-4">
                        <div className="font-black text-2xl tracking-tighter font-serif">
                            ZeroNoise<span className="text-primary">.</span>Daily
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs font-sans">
                            Curated high-importance news from around the world, delivered without the noise.
                        </p>
                    </div>

                    {/* Contact Button */}
                    <div className="flex flex-col gap-4 items-start">
                        <h4 className="font-bold uppercase tracking-widest text-sm font-sans">Connect</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                            Have feedback or questions? We'd love to hear from you.
                        </p>
                        <button
                            onClick={() => setIsContactModalOpen(true)}
                            className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-full hover:bg-primary/90 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                        >
                            <Mail className="w-4 h-4" /> Send us a message
                        </button>
                    </div>

                    {/* Legal / Copyright */}
                    <div className="flex flex-col gap-4 md:text-right">
                        <h4 className="font-bold uppercase tracking-widest text-sm font-sans">Legal</h4>
                        <div className="flex flex-col gap-2 md:items-end">
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">Privacy Policy</a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">Terms of Service</a>
                            <p className="text-xs text-muted-foreground mt-4">
                                © {new Date().getFullYear()} ZeroNoise. All rights reserved.<br />
                                ZeroNoiseDaily is a publication of ZeroNoise.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content Policy Disclaimer */}
                <div className="mt-12 pt-8 border-t border-border/50 text-center md:text-left">
                    <p className="text-[10px] text-muted-foreground/60 leading-relaxed max-w-4xl mx-auto md:mx-0">
                        ZeroNoiseDaily는 AI 뉴스 큐레이션 서비스입니다. 모든 콘텐츠와 상표의 소유권은 원저작자에게 있습니다.
                        당사는 지적재산권을 존중하며, 콘텐츠 삭제를 원하시는 저작권자께서는 상단의 문의하기를 통해 연락 주시면 즉시 조치하겠습니다.
                    </p>
                </div>
            </div>

            {/* Contact Modal */}
            <ContactModal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
            />
        </footer>
    );
}
