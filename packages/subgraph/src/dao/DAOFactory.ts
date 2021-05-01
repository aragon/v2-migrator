import { loadOrCreateDAO } from './create'
import { DeployDAO as DeployDAOEvent } from '../../generated/DAOFactory@0.6/DAOFactory'

export function handleDeployDAO(event: DeployDAOEvent): void {
  loadOrCreateDAO(event.params.dao, event.block.timestamp)
}
