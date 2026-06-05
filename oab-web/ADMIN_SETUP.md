# OAB-GPT Clinician Portal Setup

## Authentication

1. Enable **Email/Password** in Firebase Authentication.
2. Create clinician users in the Firebase Console or through a trusted admin process.
3. Do not expose Firebase account creation in the client application.

For each approved user, create:

```text
clinician_accounts/{lowercase-email-address}
```

Example document:

```json
{
  "email": "clinician@hospital.org",
  "displayName": "Dr Example",
  "role": "clinician",
  "hospitalId": "hospital-001",
  "hospitalIds": ["hospital-001"],
  "hospitalName": "Example Hospital",
  "active": true,
  "createdAt": "Firestore server timestamp",
  "updatedAt": "Firestore server timestamp"
}
```

The document ID must be the clinician's lowercase email address. This allows Firestore rules to verify access without exposing the clinician directory.

## Collections

The portal reads these top-level collections in real time:

- `conversations`
- `analytics`
- `patient_reports`
- `follow_up_surveys`
- `clinician_accounts`

All new documents should include `createdAt` and `updatedAt` server timestamps. Event-specific timestamps should also be stored, including `startedAt`, `completedAt`, `submittedAt`, and `reviewedAt`.

Add `hospitalId` to every clinical record. Clinician account documents already support `hospitalId` and `hospitalIds` so hospital-scoped Firestore queries and rules can be introduced without changing the UI data model.

## Deployment

Deploy the included Firestore rules from the repository root:

```bash
firebase deploy --only firestore:rules
```
