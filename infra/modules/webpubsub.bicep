param location string
param prefix string
param skuName string
param tags object

resource service 'Microsoft.SignalRService/WebPubSub@2024-03-01' = {
  name: '${prefix}-wps'
  location: location
  sku: {
    name: skuName
    capacity: 1
  }
  tags: tags
  properties: {
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
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
output endpoint string = service.properties.hostName
