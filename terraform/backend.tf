terraform {
  backend "s3" {
    bucket         = "terraform-state-videoprocessing"
    key            = "multi-cloud-lb/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
