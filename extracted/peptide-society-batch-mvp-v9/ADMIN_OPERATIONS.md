# Admin Operations Guide

Open `/admin` on the deployed batch application.

## Access
Enter the server-configured `PS_ADMIN_API_KEY`. The browser retains it only in session storage. Use a recognizable Audit User value such as `darren` or an operator username; server-side actions write that identity into audit records.

## Daily operating flow
1. Review Launch Blockers.
2. Review Documents Awaiting Approval.
3. Review batches in Pending Documentation / Pending Independent Testing.
4. Approve a batch only after required documents are approved.
5. Activate only approved batches with available inventory.
6. Watch Recent Lot Assignments after orders begin.
7. Use HOLD for investigation/quarantine without erasing history.
8. Use RECALL for a confirmed recall event; the system releases open reservations and preserves fulfilled-order traceability.

## Rules
- Never delete a historical batch to hide a problem.
- Never reuse a COA for another manufacturer lot.
- Never bypass APPROVED → ACTIVE state control.
- Never alter a fulfilled lot assignment silently; corrections require an auditable correction workflow.
