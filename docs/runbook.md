# Runbook

## Deployments

### Deploy to dev
```
make deploy ENV=dev
```

### Deploy to prod
```
make deploy ENV=prod
```

## Troubleshooting

### Terraform state issues
- Check remote backend config in 	erraform/environments/<env>/main.tf

### Pipeline failures
- Check CI/CD logs
- Verify service principal permissions
