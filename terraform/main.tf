terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Enable Required APIs
# Ensures that Cloud Run, Artifact Registry, and Vertex AI are active
resource "google_project_service" "run_api" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifactregistry_api" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "aiplatform_api" {
  service            = "aiplatform.googleapis.com"
  disable_on_destroy = false
}

# 2. Artifact Registry Repository
# For storing the Docker containers of our FastAPI backend
resource "google_artifact_registry_repository" "docker_repo" {
  provider      = google
  location      = var.region
  repository_id = "${var.service_name}-repo"
  description   = "Docker repository for SignSensei Backend"
  format        = "DOCKER"

  depends_on = [google_project_service.artifactregistry_api]
}

# 3. Cloud Run Service 
# The actual serverless platform running the Python API
resource "google_cloud_run_v2_service" "api_service" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      # Use a placeholder image or an initial base image for the very first deployment
      # CI/CD (GitHub actions) will dynamically update this image tag on push
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.name}/${var.image_name}:latest"
      
      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi" # Match current deployment config
        }
      }

      startup_probe {
        failure_threshold = 1
        period_seconds    = 240
        timeout_seconds   = 240
        tcp_socket {
          port = 8080
        }
      }
    }
    
    # Scale behavior limits (matches concurrency: 80 from gcloud output)
    max_instance_request_concurrency = 80
  }

  lifecycle {
    # We ignore the image tag changes because GitHub CI/CD manages the image updates.
    # If Terraform doesn't ignore this, running Terraform again would overwrite the latest deployed code!
    ignore_changes = [
      template[0].containers[0].image, 
    ]
  }

  depends_on = [google_project_service.run_api]
}

# 4. IAM - Make Cloud Run Publicly Accessible
# Opens up the API endpoint to the internet (and our React frontend)
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.api_service.location
  project  = google_cloud_run_v2_service.api_service.project
  service  = google_cloud_run_v2_service.api_service.name

  role   = "roles/run.invoker"
  member = "allUsers"
}

# 5. IAM - Give Default Compute Service Account access to Vertex AI
# This allows the API to use Gemini 2.5 Flash without hardcoded API keys
data "google_project" "project" {}

resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  # Utilizing the default compute engine service account
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}
