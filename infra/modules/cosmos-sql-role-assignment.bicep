@description('Existing Cosmos DB account name to scope the SQL RBAC role onto.')
param cosmosAccountName string

@description('Database name. Scope is database-level per security guidance.')
param databaseName string

@description('Entra principal (managed identity, user, or group) to grant data-plane access.')
param principalId string

@description('Cosmos DB built-in SQL role definition GUID. Default = Built-in Data Contributor.')
param roleDefinitionId string = '00000000-0000-0000-0000-000000000002'

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource roleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: account
  name: guid(account.id, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: '${account.id}/sqlRoleDefinitions/${roleDefinitionId}'
    principalId: principalId
    // Database-level scope per hansen-project-styles/preferences/security.md.
    scope: '${account.id}/dbs/${databaseName}'
  }
}
