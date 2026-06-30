import * as React from 'react';

/**
 * Section — from zuzuu-studio@0.1.0.
 */
export interface SectionProps {
id?: string; index?: string; label?: string; lead?: React.ReactNode; leadSize?: "manifesto" | "intro"; action?: React.ReactNode; children?: React.ReactNode; className?: string;
}

export declare const Section: React.ComponentType<SectionProps>;
