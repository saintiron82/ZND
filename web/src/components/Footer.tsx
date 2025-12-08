'use client';

import React from 'react';
import { Github, Twitter, Mail } from 'lucide-react';

export default function Footer() {
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

                    {/* Quick Links */}
                    <div className="flex flex-col gap-4">
                        <h4 className="font-bold uppercase tracking-widest text-sm font-sans">Connect</h4>
                        <div className="flex flex-col gap-2">
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm flex items-center gap-2">
                                <Twitter className="w-4 h-4" /> Twitter
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm flex items-center gap-2">
                                <Github className="w-4 h-4" /> GitHub
                            </a>
                            <a href="mailto:contact@zeronoise.daily" className="text-muted-foreground hover:text-primary transition-colors text-sm flex items-center gap-2">
                                <Mail className="w-4 h-4" /> Contact Us
                            </a>
                        </div>
                    </div>

                    {/* Legal / Copyright */}
                    <div className="flex flex-col gap-4 md:text-right">
                        <h4 className="font-bold uppercase tracking-widest text-sm font-sans">Legal</h4>
                        <div className="flex flex-col gap-2 md:items-end">
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">Privacy Policy</a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">Terms of Service</a>
                            <p className="text-xs text-muted-foreground mt-4">
                                © {new Date().getFullYear()} ZeroNoise Daily. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
