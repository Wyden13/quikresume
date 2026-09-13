// src/components/ui/form-controls.tsx
// Shared form primitives (Master Editor, Profile page, import review).
"use client";

import React from "react";

export const Label = ({ children, htmlFor, className = "" }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
    <label htmlFor={htmlFor} className={`block text-sm font-black text-black/40 mb-1.5 uppercase tracking-widest ${className}`}>
        {children}
    </label>
);

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={`w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-medium disabled:opacity-40 ${props.className || ""}`}
    />
);

export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
        {...props}
        className={`w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-black outline-none transition-all font-medium resize-none ${props.className || ""}`}
    />
);

export const Button = ({ children, onClick, variant = "default", size = "md", className = "", disabled = false, loading = false, title }: { children: React.ReactNode; onClick?: () => void; variant?: "default" | "ghost" | "primary"; size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean; loading?: boolean; title?: string }) => {
    const base = "inline-flex items-center justify-center font-black transition-all rounded-2xl active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
    const variants = {
        default: "bg-white text-black border-2 border-black/10 hover:border-black hover:bg-black/5",
        ghost: "bg-transparent text-black/40 hover:bg-black/5 hover:text-black",
        primary: "bg-black text-white hover:bg-black/80 shadow-lg shadow-black/10",
    };
    const sizes = {
        sm: "px-4 py-2 text-xs uppercase tracking-widest",
        md: "px-6 py-3.5 text-sm uppercase tracking-widest",
        lg: "px-8 py-4 text-base uppercase tracking-widest",
    };
    return (
        <button type="button" onClick={onClick} disabled={disabled || loading} title={title} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
            {loading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : null}
            {children}
        </button>
    );
};

