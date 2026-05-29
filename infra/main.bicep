targetScope = 'resourceGroup'

@description('Deployment location for all Azure resources.')
param location string = resourceGroup().location

@description('Short prefix used in resource names.')
@minLength(3)
@maxLength(12)
param prefix string = 'chatdemo'

@description('Cosmos DB database name.')
param cosmosDatabaseName string = 'chatPrototype'

@description('Enable Azure Web PubSub Free tier for cheapest prototype path when available.')
param webPubSubSkuName string = 'Free_F1'

@description('Enable Cosmos DB serverless capability for prototype workloads.')
param useCosmosServerless bool = true

@description('Container registry SKU for application images.')
param containerRegistrySku string = 'Basic'

@description('Backend container app CPU allocation.')
param backendCpu string = '0.5'

@description('Backend container app memory allocation.')
param backendMemory string = '1Gi'

@description('Frontend container app CPU allocation.')
param frontendCpu string = '0.5'

@description('Frontend container app memory allocation.')
param frontendMemory string = '1Gi'

var tags = {
  workload: 'event-chat-prototype'
  environment: 'demo'
}

var backendAppName = '${prefix}-backend'
var frontendAppName = '${prefix}-frontend'

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${prefix}acr'
  location: location
  sku: {
    name: containerRegistrySku
  }
  tags: tags
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    prefix: prefix
    tags: tags
  }
}

module webpubsub 'modules/webpubsub.bicep' = {
  name: 'webpubsub'
  params: {
    location: location
    prefix: prefix
    skuName: webPubSubSkuName
    tags: tags
  }
}

module cosmos 'modules/cosmosdb.bicep' = {
  name: 'cosmosdb'
  params: {
    location: location
    prefix: prefix
    databaseName: cosmosDatabaseName
    useServerless: useCosmosServerless
    tags: tags
  }
}

module appEnvironment 'modules/container-environment.bicep' = {
  name: 'container-environment'
  params: {
    location: location
    prefix: prefix
    tags: tags
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsSharedKey: monitoring.outputs.logAnalyticsSharedKey
  }
}

module backendApp 'modules/container-app.bicep' = {
  name: 'backend-app'
  params: {
    location: location
    name: backendAppName
    environmentId: appEnvironment.outputs.environmentId
    imageName: '${containerRegistry.properties.loginServer}/backend:bootstrap'
    targetPort: 8080
    external: true
    cpu: backendCpu
    memory: backendMemory
    tags: tags
    env: [
      {
        name: 'PORT'
        value: '8080'
      }
      {
        name: 'CORS_ORIGIN'
        value: 'https://${frontendAppName}.${location}.azurecontainerapps.io'
      }
      {
        name: 'DEMO_TENANT_ID'
        value: 'tenant-demo'
      }
      {
        name: 'DEMO_AUTH_TOKEN_TTL_MINUTES'
        value: '60'
      }
      {
        name: 'COSMOS_ENDPOINT'
        value: cosmos.outputs.endpoint
      }
      {
        name: 'COSMOS_DATABASE'
        value: cosmos.outputs.databaseName
      }
      {
        name: 'COSMOS_EVENTS_CONTAINER'
        value: cosmos.outputs.eventsContainerName
      }
      {
        name: 'COSMOS_STATE_CONTAINER'
        value: cosmos.outputs.stateContainerName
      }
      {
        name: 'WEB_PUBSUB_HUB'
        value: 'chat'
      }
    ]
    secretEnv: [
      {
        name: 'COSMOS_KEY'
        secretValue: cosmos.outputs.primaryKey
      }
      {
        name: 'WEB_PUBSUB_CONNECTION_STRING'
        secretValue: webpubsub.outputs.connectionString
      }
      {
        name: 'DEMO_AUTH_SECRET'
        secretValue: '${prefix}-demo-auth-secret'
      }
      {
        name: 'ACR_PASSWORD'
        secretValue: listCredentials(containerRegistry.id, containerRegistry.apiVersion).passwords[0].value
      }
    ]
    registryIdentity: {
      server: containerRegistry.properties.loginServer
      username: listCredentials(containerRegistry.id, containerRegistry.apiVersion).username
      passwordSecretRef: 'ACR_PASSWORD'
    }
  }
}

module frontendApp 'modules/container-app.bicep' = {
  name: 'frontend-app'
  params: {
    location: location
    name: frontendAppName
    environmentId: appEnvironment.outputs.environmentId
    imageName: '${containerRegistry.properties.loginServer}/frontend:bootstrap'
    targetPort: 80
    external: true
    cpu: frontendCpu
    memory: frontendMemory
    tags: tags
    env: [
      {
        name: 'VITE_API_BASE_URL'
        value: 'https://${backendAppName}.${location}.azurecontainerapps.io/api'
      }
    ]
    secretEnv: [
      {
        name: 'ACR_PASSWORD'
        secretValue: listCredentials(containerRegistry.id, containerRegistry.apiVersion).passwords[0].value
      }
    ]
    registryIdentity: {
      server: containerRegistry.properties.loginServer
      username: listCredentials(containerRegistry.id, containerRegistry.apiVersion).username
      passwordSecretRef: 'ACR_PASSWORD'
    }
  }
}

output APPLICATION_INSIGHTS_CONNECTION_STRING string = monitoring.outputs.applicationInsightsConnectionString
output WEB_PUBSUB_NAME string = webpubsub.outputs.serviceName
output WEB_PUBSUB_ENDPOINT string = webpubsub.outputs.endpoint
output AZURE_COSMOS_ACCOUNT_NAME string = cosmos.outputs.accountName
output COSMOS_PRIMARY_KEY string = cosmos.outputs.primaryKey
output COSMOS_ENDPOINT string = cosmos.outputs.endpoint
output COSMOS_DATABASE string = cosmos.outputs.databaseName
output COSMOS_EVENTS_CONTAINER string = cosmos.outputs.eventsContainerName
output COSMOS_STATE_CONTAINER string = cosmos.outputs.stateContainerName
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.name
output AZURE_CONTAINER_REGISTRY_LOGIN_SERVER string = containerRegistry.properties.loginServer
output AZURE_BACKEND_CONTAINER_APP_NAME string = backendAppName
output AZURE_FRONTEND_CONTAINER_APP_NAME string = frontendAppName
output BACKEND_URL string = backendApp.outputs.fqdn
output FRONTEND_URL string = frontendApp.outputs.fqdn
