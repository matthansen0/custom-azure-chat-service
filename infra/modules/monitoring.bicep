param location string
param prefix string
param tags object

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-appi'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: ''
  }
}

output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
