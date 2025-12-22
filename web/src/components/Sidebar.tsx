'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Tag, Info, Moon, Sun, Menu } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = React.useState(true);

    // Toggle collapse on desktop, full menu on mobile
    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    const navItems = [
        { icon: Home, label: 'Home', href: '/' },
        { icon: Calendar, label: 'Archive', href: '/archive' }, // Placeholder
        { icon: Tag, label: 'Topics', href: '/topics' }, // Placeholder
        { icon: Info, label: 'About', href: '/about' }, // Placeholder
    ];

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={toggleSidebar}
                className="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-zinc-900 rounded-full shadow-md md:hidden border border-zinc-200 dark:border-zinc-800"
            >
                <Menu className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </button>

            {/* Sidebar Container */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-40 flex flex-col bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-r border-zinc-200/50 dark:border-zinc-800/50 transition-all duration-300 ease-in-out",
                    isCollapsed ? "-translate-x-full md:translate-x-0 md:w-20" : "translate-x-0 w-64"
                )}
            >
                {/* Logo Area */}
                <div className="h-20 flex items-center justify-center border-b border-zinc-100/50 dark:border-zinc-900/50">
                    <div className={cn("font-serif font-black text-2xl tracking-tighter transition-opacity", isCollapsed ? "md:opacity-0 md:hidden" : "opacity-100")}>
                        ZE<span className="text-teal-500">.</span>D
                    </div>
                    <div className={cn("font-serif font-black text-xl tracking-tighter absolute transition-opacity", isCollapsed ? "md:opacity-100" : "opacity-0 hidden")}>
                        Z
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-8 flex flex-col gap-2 px-3">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group",
                                    isActive
                                        ? "bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400"
                                        : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100",
                                    isCollapsed ? "md:justify-center" : ""
                                )}
                                title={isCollapsed ? item.label : undefined}
                            >
                                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "fill-current")} strokeWidth={2} />
                                <span className={cn("font-medium text-sm whitespace-nowrap transition-all", isCollapsed ? "md:hidden" : "block")}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer / Theme Toggle */}
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-900 flex flex-col gap-4">
                    <button
                        onClick={() => document.documentElement.classList.toggle('dark')}
                        className={cn(
                            "flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-500",
                            isCollapsed ? "md:justify-center" : ""
                        )}
                    >
                        <Sun className="w-5 h-5 hidden dark:block" />
                        <Moon className="w-5 h-5 block dark:hidden" />
                        <span className={cn("font-medium text-sm", isCollapsed ? "md:hidden" : "block")}>
                            Theme
                        </span>
                    </button>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden md:flex items-center justify-center p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                        <div className="w-1 h-8 bg-zinc-200 dark:bg-zinc-800 rounded-full group-hover:bg-zinc-300" />
                    </button>
                </div>
            </aside>
        </>
    );
}
