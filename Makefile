.PHONY: init plan apply destroy deploy

ENV ?= dev

init:
	terraform -chdir=terraform/environments/$(ENV) init

plan:
	terraform -chdir=terraform/environments/$(ENV) plan

apply:
	terraform -chdir=terraform/environments/$(ENV) apply

destroy:
	terraform -chdir=terraform/environments/$(ENV) destroy

deploy:
	pwsh scripts/powershell/Deploy-App.ps1 -Env $(ENV)

healthcheck:
	bash scripts/bash/healthcheck.sh
