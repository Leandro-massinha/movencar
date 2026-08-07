declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: {
        userId: string;
        companyId: string;
        branchId: string;
        sessionId: string;
        roles: string[];
        permissions: string[];
      };
    }
  }
}
export {};
