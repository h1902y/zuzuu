import * as React from 'react';

/**
 * Button — from zuzuu-studio@0.1.0.
 */
export interface ButtonProps {
href: string; children: React.ReactNode; variant?: "primary" | "ink" | "outline" | "block"; icon?: unknown; className?: string;
}

export declare const Button: React.ComponentType<ButtonProps>;
