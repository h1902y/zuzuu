import * as React from 'react';

/**
 * Lead — from zuzuu-studio@0.1.0.
 */
export interface LeadProps {
size?: "manifesto" | "intro"; className?: string; children: React.ReactNode;
}

export declare const Lead: React.ComponentType<LeadProps>;
