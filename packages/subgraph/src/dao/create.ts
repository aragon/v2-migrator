import { BigInt, Address } from '@graphprotocol/graph-ts'

import { DAO as DAOEntity } from '../../generated/schema'
import { Kernel as KernelTemplate } from '../../generated/templates'

export function loadOrCreateDAO(address: Address, timestamp: BigInt): DAOEntity {
  let dao = DAOEntity.load(address.toHexString())

  if (dao == null) {
    dao = new DAOEntity(address.toHexString())
    dao.createdAt = timestamp
    dao.save()
    KernelTemplate.create(address)
  }

  return dao!
}
