import { Dao, Network } from './src/types'

import Encoder from './src/encoder'
import Subgraph from './src/subgraph'

/**
 * @dev This encoder basically provides an EVM script to migrate all the funds of a DAO to a specific recipient.
 * Funds are fetched from a Vault subgraph, considered an external dependency. This encoder assumes the outputted EVM
 * scripts will be executed through a Voting app, either directly or through a Token Manager app. Additionally, it
 * supports 3 types of DAO layouts in terms of its roles for the asset transfers:
 *  1. Vault: The Voting app has permissions to transfer the Vault's assets.
 *  2. Agent: Same as 1, the Voting app has permissions to transfer the Agent's assets.
 *  3. Finance: The Voting app has permissions to execute payments on the Finance app which has permissions to transfer the Vault's or Agent's assets.
 *
 *  This layouts are specified through the `dao` parameter where the `vault` property is used to indicate the Vault or
 *  Agent app address holding the funds, and `voting` the address of the Voting app. Then, `finance` and `tokenManager`
 *  are both optional to tell whether the assets transfer should be performed through the Finance app and to tell if
 *  the vote should go through the Token Manager respectively.
 *  Finally, `address` is simply used to indicate the DAO address and the `executor` to tell the recipient of the funds.
 */
export default async (network: Network, dao: Dao): Promise<string|null> => {
  const assets = await Subgraph.getAssets(network, dao)
  if(assets.length == 0) {
    return null
  }
  const script = Encoder.encodeTransferAllCallScript(dao, assets, dao.executor)
  return Encoder.encodeNewVote(dao, script, dao.executor)
}
