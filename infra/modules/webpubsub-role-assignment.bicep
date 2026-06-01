@description('Existing Web PubSub service name to scope the role assignment onto.')
param webPubSubName string

@description('Entra principal to grant the role to (managed identity object id).')
param principalId string

@description('Principal type. Defaults to ServicePrincipal for system-assigned MIs.')
@allowed([
  'ServicePrincipal'
  'User'
  'Group'
])
param principalType string = 'ServicePrincipal'

@description('Web PubSub built-in role definition GUID. Default = Web PubSub Service Owner.')
param roleDefinitionId string = '12cf5a90-567b-43ae-8102-96cf46c7d9b4'

resource service 'Microsoft.SignalRService/WebPubSub@2024-03-01' existing = {
  name: webPubSubName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: service
  name: guid(service.id, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: principalType
  }
}
