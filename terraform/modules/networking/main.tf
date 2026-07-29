# Reusable networking module
# Referenced by: terraform/environments/*/main.tf

variable "environment" {}
variable "location"    {}

resource "azurerm_resource_group" "networking" {
  name     = "rg-networking-${var.environment}"
  location = var.location
}
