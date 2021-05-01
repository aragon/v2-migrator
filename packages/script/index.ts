import { Dao, Network } from './src/types'

import Encoder from './src/encoder'
import Subgraph from './src/subgraph'

export default async (network: Network, dao: Dao): Promise<string> => {
  const assets = await Subgraph.getAssets(network, dao)
  const script = Encoder.encodeTransferAllCallScript(dao, assets, dao.executor)
  return Encoder.encodeNewVote(dao, script, dao.executor)
}
