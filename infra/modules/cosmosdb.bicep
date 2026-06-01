param location string
param accountName string
param databaseName string
param useServerless bool
param tags object

var eventsContainerName = 'events'
var stateContainerName = 'state'

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  kind: 'GlobalDocumentDB'
  tags: tags
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: useServerless ? [
      {
        name: 'EnableServerless'
      }
    ] : []
    publicNetworkAccess: 'Enabled'
    enableAutomaticFailover: false
    minimalTlsVersion: 'Tls12'
  }
}

resource sqlDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: account
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

resource eventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: sqlDatabase
  name: eventsContainerName
  properties: {
    resource: {
      id: eventsContainerName
      partitionKey: {
        paths: [
          '/roomId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/payload/largeProjection/*'
          }
        ]
      }
    }
  }
}

resource stateContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: sqlDatabase
  name: stateContainerName
  properties: {
    resource: {
      id: stateContainerName
      partitionKey: {
        paths: [
          '/entityPartition'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
      }
    }
  }
}

output accountName string = account.name
output endpoint string = account.properties.documentEndpoint
output primaryKey string = listKeys(account.id, account.apiVersion).primaryMasterKey
output databaseName string = sqlDatabase.name
output eventsContainerName string = eventsContainer.name
output stateContainerName string = stateContainer.name
