# Stored XSS local lifecycle ? Refs #38

Implemented and verified locally in the integration branch. The real review API
stores a harmless marker in PostgreSQL. Chromium executes it only in explicitly
enabled lab rendering; secure React displays the same content as text. Production
refuses the lab flag. No cookie/token collection occurs.

[Commands, captured results, exact scope and remaining review](../TEST-02/local-20261025/README.md).
