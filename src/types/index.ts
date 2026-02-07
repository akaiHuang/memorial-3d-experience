export type MemoryType = 'photo' | 'text' | 'audio';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string; // URL for photo/audio, text for text
  author?: string;
  timestamp: number;
  color?: string; // Primary color for audio sphere or text background
  color2?: string; // Secondary color for audio sphere
  description?: string; // Optional text for photos
  deleted?: boolean; // Soft delete flag
  deletedAt?: number; // Timestamp when deleted
  phone?: string;
  email?: string;
  storytellingInterest?: boolean;
  relationship?: string;
  storytellingContent?: string;
}
