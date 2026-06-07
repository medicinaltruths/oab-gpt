# OAB-GPT Assessment Tracking Setup

## Clinician Authentication

Enable Email/Password in Firebase Authentication. Clinicians cannot self-register in the application.

Create each approved account in Firebase Authentication, then create:

```text
clinician_accounts/{lowercase-email-address}
```

Example:

```json
{
  "email": "clinician@hospital.org",
  "displayName": "Mr Deji Akiboye",
  "role": "clinician",
  "hospitalId": "esth",
  "hospitalIds": ["esth"],
  "hospitalName": "Epsom and St Helier",
  "active": true
}
```

The document ID must be the clinician's lowercase email address.

Existing clinician documents without hospital fields are treated as `esth` for backward compatibility. Add the explicit fields when possible:

```json
{
  "hospitalId": "esth",
  "hospitalIds": ["esth"]
}
```

## Assessment Collection

Website and WhatsApp assessments write to:

```text
patient_assessments/{assessmentId}
```

Questionnaires and reviews are stored at:

```text
patient_assessments/{assessmentId}/preClinicQuestionnaire/latest
patient_assessments/{assessmentId}/postClinicQuestionnaire/latest
patient_assessments/{assessmentId}/clinicianReview/latest
```

Every assessment and subcollection document contains `hospitalId`. The clinician portal queries only the hospitals listed on the signed-in clinician account.

The dashboard reads exclusively from `patient_assessments`, `preClinicQuestionnaire`, and `clinicianReview`. OpenAI response logs are not a dashboard data source.

## Environment

Website:

```text
NEXT_PUBLIC_DEFAULT_HOSPITAL_ID=esth
OPENAI_RESPONSE_PROMPT_VERSION=15
```

Cloud Functions:

```text
DEFAULT_HOSPITAL_ID=esth
CHAT_API_URL=https://your-domain.example/api/chat
```

## PDF Retention

Generated reports are retained in Firebase Storage for 365 days. Patients receive a signed URL that expires after 48 hours; clinicians open the retained object through authenticated Firebase Storage access. Each assessment stores:

- `pdfDownloadUrl` and legacy alias `pdfUrl`
- `pdfStoragePath` and legacy alias `storagePath`
- `pdfCreatedAt` and legacy alias `reportCreatedAt`
- `pdfDownloadUrlExpiresAt`
- `reportRetentionUntil` and legacy alias `reportExpiryDate`
- `promptVersion`

The public URL expiry does not delete the PDF or its Firestore metadata. Ensure the Firebase Storage bucket does not have a lifecycle rule that deletes `reports/` objects before 365 days.

Assessment milestones are written under:

```text
analytics/events/items/{assessmentId}_{eventType}
```

Event types are `assessment_started`, `assessment_completed`, `recommendation_generated`, and `pdf_generated`.

## Deployment

From the repository root:

```bash
firebase deploy --project oab-decision-aid --only firestore:rules,storage,functions
```

After deployment, use `/admin/data-sources` to confirm that assessment and WhatsApp records are arriving.

If the dashboard reports `Missing or insufficient permissions`, confirm:

1. The clinician document ID exactly matches the lowercase Firebase Authentication email.
2. The clinician document has `active: true`.
3. The clinician document has `hospitalId: "esth"` or relies on the legacy `esth` fallback.
4. The latest `firestore.rules` file has been deployed to `oab-decision-aid`.
