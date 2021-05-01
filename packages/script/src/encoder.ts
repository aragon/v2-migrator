import { utils } from 'ethers'
import { Dao, DaoAsset } from './types'

const VAULT_ABI = require('../abi/Vault.json')
const VOTING_ABI = require('../abi/Voting.json')
const FINANCE_ABI = require('../abi/Finance.json')
const TOKEN_MANAGER_ABI = require('../abi/TokenManager.json')

const CALLSCRIPT_ID = '0x00000001'
const PAYMENT_REFERENCE = 'Transfer funds to govern executor'
const MIGRATION_METADATA = 'Migrate all funds to govern executor'

const Encoder = {
  encodeNewVote(dao: Dao, script: string, executor: string): string {
    const voting = new utils.Interface(VOTING_ABI)
    const votingData = voting.encodeFunctionData('newVote', [script, `${MIGRATION_METADATA}: ${executor}`, true, true])

    if (!dao.tokenManager) return votingData

    const votingScript = Encoder.encodeCallsScript([{ to: dao.voting, data: votingData }])
    const tokenManager = new utils.Interface(TOKEN_MANAGER_ABI)
    return tokenManager.encodeFunctionData('forward', [votingScript])
  },

  encodeTransferAllCallScript(dao: Dao, assets: DaoAsset[], recipient: string): string {
    return Encoder.encodeCallsScript(assets.map(asset => {
      if (dao.finance) {
        const data = Encoder.encodePayment(asset.token, recipient, asset.amount)
        return { to: dao.finance, data }
      } else {
        const data = Encoder.encodeTransfer(asset.token, recipient, asset.amount)
        return { to: dao.vault, data }
      }
    }))
  },

  encodeTransfer(token: string, recipient: string, amount: string): string {
    const vault = new utils.Interface(VAULT_ABI)
    return vault.encodeFunctionData('transfer', [token, recipient, amount])
  },

  encodePayment(token: string, recipient: string, amount: string): string {
    const finance = new utils.Interface(FINANCE_ABI)
    return finance.encodeFunctionData('newImmediatePayment', [token, recipient, amount, PAYMENT_REFERENCE])
  },

  encodeCallsScript(actions: Array<{ to: string, data: string }>): string {
    return actions.reduce((script: string, { to, data }) => {
      const address = utils.defaultAbiCoder.encode(['address'], [to])
      const dataLength = utils.defaultAbiCoder.encode(['uint256'], [(data.length - 2) / 2])
      return script + address.slice(26) + dataLength.slice(58) + data.slice(2)
    }, CALLSCRIPT_ID)
  },
}

export default Encoder;
