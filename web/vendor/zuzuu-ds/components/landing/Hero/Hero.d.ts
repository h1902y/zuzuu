import * as React from 'react';

/**
 * Hero — from zuzuu-studio@0.1.0.
 */
export interface HeroProps {
badge: string; title: string; subtitle: string; actions: { label: string; href: string; variant?: "primary" | "ink" | "outline" }[]; stats: { value: string; label: string }[];
}

export declare const Hero: React.ComponentType<HeroProps>;
