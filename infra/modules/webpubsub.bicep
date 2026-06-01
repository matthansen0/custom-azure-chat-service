param location string
param serviceName string
param skuName string
param tags object

resource service 'Microsoft.SignalRService/WebPubSub@2024-03-01' = {
  name: serviceName
  location: location
  sku: {
    name: skuName
    capacity: 1
  }
  tags: tags
  properties: {
    publicNetworkAccess: 'Enabled'
    // Entra ID only. Local auth (connection strings / access keys) is disabled per
    // tenant security policy. Backend authenticates with DefaultAzureCredential.
    disableLocalAuth: true
    liveTraceConfiguration: {
      categories: [
        {
          name: 'ConnectivityLogs'
          enabled: 'true'
        }
        {
          name: 'MessagingLogs'
          enabled: 'true'
        }
      ]
      enabled: 'true'
    }
  }
}

output serviceName string = service.name
output serviceId string = service.id
output endpoint string = 'https://${service.properties.hostName}'
