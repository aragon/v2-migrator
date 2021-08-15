import { request } from 'graphql-request'

import { Dao, DaoAsset, Network } from './types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const SUBGRAPH_URL: { [key: string]: string } = {
  rinkeby: 'https://api.thegraph.com/subgraphs/name/aragon/aragon-vault-rinkeby',
  mainnet: 'https://api.thegraph.com/subgraphs/name/aragon/aragon-vault-mainnet',
}

const Subgraph = {
  async getAssets(network: Network, dao: Dao): Promise<DaoAsset[]> {
    const url = SUBGRAPH_URL[network]
    if (!url) throw Error(`Unknown network ${network}`)

    const result = await request(url, `{
      tokenBalances (where: { vault: "${dao.vault.toLowerCase()}" }) {
        balance
        token {
          id
        }
      }
    }`)

    return result.tokenBalances
      .map((balance: any) => ({ token: balance.token.id, amount: balance.balance }))
      .filter((balance: DaoAsset) => balance.amount !== '0')
  }
}

export default Subgraph
