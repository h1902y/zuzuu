import * as React from 'react';

/**
 * TierCard — from zuzuu-studio@0.1.0.
 */
export interface TierCardProps {
id: string; name: string; outcome: string; price: string; mode: string; forWhom: string; includes: string[]; involvement: 1 | 2 | 3; cta: { label: string; href: string }; featured?: boolean;
}

export declare const TierCard: React.ComponentType<TierCardProps>;
