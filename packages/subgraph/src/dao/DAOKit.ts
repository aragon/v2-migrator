import { loadOrCreateDAO } from './create'
import { DeployInstance as DeployInstanceEvent } from '../../generated/bare-kit.aragonpm.eth@1.0.0/DAOKit'

export function handleDeployInstance(event: DeployInstanceEvent): void {
  loadOrCreateDAO(event.params.dao, event.block.timestamp)
}
