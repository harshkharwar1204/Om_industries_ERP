# Firebase Security Specification

## 1. Data Invariants
- **Authentication**: All writes must be fully authenticated; unauthenticated reads are blocked except for the workers registry lookup during initial login validation.
- **Role Isolation**: Only 'owner' or 'manager' users can create or modify public role accounts and create tasks.
- **Worker Isolation**: A worker can ONLY read tasks assigned to them, and can ONLY update the `status` and `updatedAt` fields of their assigned tasks.
- **PII Protection**: User's private contact details (`/users/{userId}/private/info`) are strictly readable only by the owner of that profile or a verified 'owner' account.
- **Worker Registry Integrity**: Custom Worker IDs are immutable; their lookup entries cannot be modified or deleted by workers.
- **Temporal Consistency**: Timestamps like `createdAt` and `updatedAt` are validated against `request.time`.

## 2. The "Dirty Dozen" Payloads (Security Vulnerabilities Checked)
1. **Unauthenticated Read on Tasks**: Attacker tries to download `/tasks/` collection.
2. **Unauthenticated User Profile Alteration**: Attacker attempts to write a document inside `/users/attackerId` without auth.
3. **Privilege Escalation on Register**: A regular user attempts to create a profile under `/users/myUserId` with `role: "owner"`.
4. **Worker Steals Private Contact Info**: A user with role 'worker' attempts to read `/users/anotherUserId/private/info`.
5. **Unauthorized Task Creation**: A 'worker' attempts to create a document under `/tasks/testTask`.
6. **Task Status Hijacking by Non-Assignee**: 'worker-1' attempts to update the status of a task assigned to 'worker-2'.
7. **Task Field Tampering**: An assigned worker attempts to change the `title` or `description` of their task.
8. **Worker Registry Poisoning**: An authenticated worker attempts to modify `/workers/W-101` to map it to a new `mobileNumber` or change their metadata.
9. **Role Modification Post-Creation**: Active user attempts to change their role from 'manager' to 'owner' on `/users/myUserId` during update.
10. **Timestamp Forgery**: User attempts to set a custom historical date for `createdAt` during task generation instead of `request.time`.
11. **Document ID Poisoning**: Attacker tries to create a task with a massive 100KB string of garbage characters as the document ID.
12. **Foreign Parent Binding**: User creates a task mapping to a non-existent or foreign Worker ID.

## 3. Firestore Rules Validation DRAFT
Below we will declare and deploy `/firestore.rules` containing our access control list (ACL) rules guarding these blocks and then we will write ESLint validations.
