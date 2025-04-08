terraform {
  backend "s3" {
    bucket         = "mybuket65443"
    key            = "multi-cloud-lb/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
