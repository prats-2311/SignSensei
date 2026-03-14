variable "project_id" {
  description = "The ID of the GCP project"
  type        = string
  default     = "signsensei"
}

variable "region" {
  description = "The region for Cloud Run and Artifact Registry"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "The name of the Cloud Run service"
  type        = string
  default     = "signsensei-api"
}

variable "image_name" {
  description = "The name of the Docker image"
  type        = string
  default     = "signsensei-api"
}
