// ========================================
// Tipos do projeto
// ========================================

export interface Family {
  id: string;
  familyName: string;
  members: string[];
  side: 'raynara' | 'gabriel';
}

export interface FamiliesFile {
  families: Omit<Family, 'side'>[];
}

export type MemberStatus = 'confirmed' | 'declined';

export type MemberResponses = Record<string, MemberStatus | null>;

export interface RsvpData {
  familyId: string;
  familyName: string;
  side: string;
  responses: Record<string, MemberStatus>;
  respondedAt: string;
}
