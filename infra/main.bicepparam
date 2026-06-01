using './main.bicep'

param location = 'eastus2'
param prefix = 'chatdemo'
param cosmosDatabaseName = 'chatPrototype'
param webPubSubSkuName = 'Free_F1'
param useCosmosServerless = true
param containerRegistrySku = 'Basic'
param backendCpu = '0.5'
param backendMemory = '1Gi'
param frontendCpu = '0.5'
param frontendMemory = '1Gi'
// azd injects AZURE_PRINCIPAL_ID automatically; empty fallback means "skip the deployer role".
param deployingUserPrincipalId = readEnvironmentVariable('AZURE_PRINCIPAL_ID', '')
