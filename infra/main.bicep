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

var tags = {
  workload: 'event-chat-prototype'
  environment: 'demo'
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

output applicationInsightsConnectionString string = monitoring.outputs.applicationInsightsConnectionString
output webPubSubName string = webpubsub.outputs.serviceName
output webPubSubEndpoint string = webpubsub.outputs.endpoint
output cosmosAccountName string = cosmos.outputs.accountName
output cosmosEndpoint string = cosmos.outputs.endpoint
output cosmosDatabase string = cosmos.outputs.databaseName
output cosmosEventsContainer string = cosmos.outputs.eventsContainerName
output cosmosStateContainer string = cosmos.outputs.stateContainerName
