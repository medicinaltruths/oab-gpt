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

Generated reports are stored in Firebase Storage with a stable Firebase download-token URL. Each assessment stores:

- `pdfUrl`
- `storagePath`
- `reportCreatedAt`
- `reportExpiryDate`
- `promptVersion`

`reportExpiryDate` is set to 365 days after report generation. Ensure the Firebase Storage bucket does not have a lifecycle rule that deletes `reports/` objects before 365 days.

## Deployment

From the repository root:

```bash
firebase deploy --only firestore:rules,storage,functions
```

After deployment, use `/admin/data-sources` to confirm that assessment and WhatsApp records are arriving.
