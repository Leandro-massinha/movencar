# Session Policy

MovenCar permits one active session per user. Successful login revokes prior sessions with `NEW_LOGIN`. Every protected request verifies its database session. A revoked or expired session receives HTTP 401 and `SESSION_REVOKED`.

Refresh tokens rotate on use. Users can inspect and revoke their own sessions. Security events are auditable.
