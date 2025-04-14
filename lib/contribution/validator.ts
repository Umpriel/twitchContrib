import db from '../db';

export interface ValidationResult {
  personalDuplicate: boolean;
  acceptedDuplicate: boolean;
  lineConflict: boolean;
}

export async function validateContribution(
  filename: string,
  lineNumber: number | null,
  codeHash: string,
  username: string
): Promise<ValidationResult> {
  try {
    return await db.checkContributionConflicts(
      filename,
      lineNumber,
      codeHash,
      username
    );
  } catch (error) {
    console.error('Error validating contribution:', error);
    return {
      personalDuplicate: false,
      acceptedDuplicate: false,
      lineConflict: false
    };
  }
} 