#!/bin/bash
set -e

# Import APIs
terraform import google_project_service.run_api signsensei/run.googleapis.com || echo "Already imported or error"
terraform import google_project_service.artifactregistry_api signsensei/artifactregistry.googleapis.com || echo "Already imported or error"
terraform import google_project_service.aiplatform_api signsensei/aiplatform.googleapis.com || echo "Already imported or error"

# Import Cloud Run service
terraform import google_cloud_run_v2_service.api_service projects/signsensei/locations/us-central1/services/signsensei-api || echo "Already imported or error"

# Import IAM binding for public Cloud Run endpoint
terraform import google_cloud_run_service_iam_member.public_access "projects/signsensei/locations/us-central1/services/signsensei-api roles/run.invoker allUsers" || echo "Already imported or error"

# Import Vertex AI User role for compute service account
terraform import google_project_iam_member.vertex_ai_user "signsensei roles/aiplatform.user serviceAccount:182928399501-compute@developer.gserviceaccount.com" || echo "Already imported or error"

