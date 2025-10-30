/**
 * Internal command model for CV deletion
 * Used in service layer to encapsulate deletion parameters
 */
export interface DeleteCvCommand {
  /**
   * UUID of the CV to delete
   */
  cvId: string;

  /**
   * UUID of the user requesting deletion (from JWT token)
   */
  userId: string;
}
