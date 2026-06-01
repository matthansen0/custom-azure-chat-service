param location string
param name string
param environmentId string
param imageName string
param targetPort int
param external bool
param cpu string
param memory string
param tags object
param env array = []
param secretEnv array = []
param registryIdentity object
param serviceName string = ''

var secrets = [for secret in secretEnv: {
  name: secret.name
  value: secret.secretValue
}]

var plainEnvironmentVariables = [for entry in env: {
  name: entry.name
  value: entry.value
}]

var secretEnvironmentVariables = [for secret in secretEnv: {
  name: contains(secret, 'envName') ? secret.envName : secret.name
  secretRef: secret.name
}]

var environmentVariables = concat(plainEnvironmentVariables, secretEnvironmentVariables)

var azdTags = serviceName != '' ? { 'azd-service-name': serviceName } : {}

resource containerApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: name
  location: location
  tags: union(tags, azdTags)
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: external
        targetPort: targetPort
        transport: 'auto'
      }
      registries: [
        {
          server: registryIdentity.server
          username: registryIdentity.username
          passwordSecretRef: registryIdentity.passwordSecretRef
        }
      ]
      secrets: secrets
      activeRevisionsMode: 'Single'
    }
    template: {
      containers: [
        {
          name: name
          image: imageName
          env: environmentVariables
          resources: {
            cpu: json(cpu)
            memory: memory
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

output fqdn string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output appId string = containerApp.id
