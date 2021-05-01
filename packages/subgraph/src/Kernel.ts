import { loadOrCreateDAO } from './dao/create'
import { loadOrCreateVoting } from './Voting'
import { Voting as VotingTemplate } from '../generated/templates'
import { NewAppProxy as NewAppProxyEvent } from '../generated/templates/Kernel/Kernel'

const VOTING_ID = '0x9fa3927f639745e587912d4b0fea7ef9013bf93fb907d29faeab57417ba6e1d4'
const VAULT_APP_ID = '0x7e852e0fcfce6551c13800f1e7476f982525c2b5277ba14b24339c68416336d1'
const AGENT_APP_ID = '0x9ac98dc5f995bf0211ed589ef022719d1487e5cb2bab505676f0d084c07cf89a'
const FINANCE_APP_ID = '0xbf8491150dafc5dcaee5b861414dca922de09ccffa344964ae167212e8c673ae'

export function handleNewAppProxy(event: NewAppProxyEvent): void {
  const dao = loadOrCreateDAO(event.address, event.block.timestamp)

  const address = event.params.proxy
  const appId = event.params.appId.toHexString()

  if (appId == VOTING_ID && dao.voting == null) {
    dao.voting = address.toHexString()
    dao.save()
    loadOrCreateVoting(address, event.block.timestamp)
    VotingTemplate.create(address)
  } else if (appId == VAULT_APP_ID || appId == AGENT_APP_ID) {
    dao.vault = address
    dao.save()
  } else if (appId == FINANCE_APP_ID) {
    dao.finance = address
    dao.save()
  }
}
