import * as React from 'react';

/**
 * ComparisonTable — from zuzuu-studio@0.1.0.
 */
export interface ComparisonTableProps {
columns: string[]; rows: { criterion: string; values: (boolean | string)[] }[]; caption?: string;
}

export declare const ComparisonTable: React.ComponentType<ComparisonTableProps>;
