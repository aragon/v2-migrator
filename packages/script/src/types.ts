export type Dao = {
  address: string
  voting: string
  vault: string
  executor: string
  finance?: string
  tokenManager?: string
}

export type DaoAsset = {
  token: string
  amount: string
}

export type Network = 'mainnet' | 'rinkeby'
