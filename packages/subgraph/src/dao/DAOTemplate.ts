import { loadOrCreateDAO } from './create';
import { DeployDao as DeployDaoEvent } from '../../generated/bare-template.aragonpm.eth@1.0.0/DAOTemplate'

export function handleDeployDao(event: DeployDaoEvent): void {
  loadOrCreateDAO(event.params.dao, event.block.timestamp)
}
