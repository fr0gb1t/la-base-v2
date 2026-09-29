/**
 * Game round structures for La Base
 * Each number represents the number of hands (bases) to play in that round
 */

import type { GameStructure } from './types.js';

export const STRUCTURES: Record<Exclude<GameStructure, 'custom'>, number[]> = {
  clasica: [1, 3, 5, 5, 3, 1, 1, 3, 5, 5, 3, 1], // 12 rounds
  alternativa: [1, 3, 5, 6, 6, 5, 3, 1, 1, 3, 5, 6, 6, 5, 3, 1], // 16 rounds
  postpandemia: [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1], // 12 rounds
};

/**
 * Get the structure sequence for a given game structure
 */
export function getStructure(structure: GameStructure, custom?: number[]): number[] {
  if (structure === 'custom' && custom) {
    return custom;
  }
  if (structure === 'custom') {
    return STRUCTURES.clasica; // fallback
  }
  return STRUCTURES[structure];
}

/**
 * Get total number of bases in a structure
 */
export function getTotalBases(structure: GameStructure, custom?: number[]): number {
  const seq = getStructure(structure, custom);
  return seq.reduce((sum, bases) => sum + bases, 0);
}

/**
 * Get number of bases for a specific round
 */
export function getBasesForRound(
  structure: GameStructure,
  roundIndex: number,
  custom?: number[]
): number {
  const seq = getStructure(structure, custom);
  return seq[roundIndex] || 0;
}

/**
 * Check if a structure is valid
 */
export function isValidStructure(structure: string): structure is GameStructure {
  return structure === 'clasica' || structure === 'alternativa' || structure === 'postpandemia';
}

/**
 * Validate a custom structure
 */
export function isValidCustomStructure(structure: number[]): boolean {
  return (
    Array.isArray(structure) &&
    structure.length > 0 &&
    structure.length <= 20 &&
    structure.every((n) => typeof n === 'number' && n > 0 && n <= 12)
  );
}
