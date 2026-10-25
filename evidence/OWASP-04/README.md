# Authentication local lifecycle ? Refs #40

Implemented and verified locally: 12 bounded synthetic wrong-password attempts.
The lab disables only the login limiter; secure mode returns 429 from attempt 11.
Bcrypt, CSRF and PostgreSQL sessions remain active. This demonstrates one rate-limit
scenario, not complete authentication security. Production refuses the lab flag.

[Commands, captured results, exact scope and remaining review](../TEST-02/local-20261025/README.md).
