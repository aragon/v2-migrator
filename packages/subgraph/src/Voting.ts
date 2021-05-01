import { Address, BigInt } from '@graphprotocol/graph-ts'

import { ERC20 as ERC20Contract } from '../generated/templates/Voting/ERC20'
import { StartVote as StartVoteEvent, ExecuteVote as ExecuteVoteEvent, Voting as VotingContract } from '../generated/templates/Voting/Voting'
import { DAO as DAOEntity, Asset as AssetEntity, Voting as VotingEntity, Migration as MigrationEntity, ERC20 as ERC20Entity } from '../generated/schema'
import { decodeAmounts, decodeExecutor, decodeTokens, decodeMigrationType } from '../utils/migration'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function handleStartVote(event: StartVoteEvent): void {
  const voting = loadOrCreateVoting(event.address, event.block.timestamp)
  const votingApp = VotingContract.bind(event.address)
  const voteData = votingApp.getVote(event.params.voteId)
  const script = voteData.value9.toHexString()

  const type = decodeMigrationType(voting, script)
  if (type != 0) {
    const dao = DAOEntity.load(voting.dao)!
    const migrationId = buildMigrationId(event.address, event.params.voteId)
    const migration = new MigrationEntity(migrationId)
    migration.voting = event.address.toHexString()
    migration.executor = decodeExecutor(script, type).toHexString()
    migration.voteId = event.params.voteId
    migration.creator = event.params.creator
    migration.metadata = event.params.metadata
    migration.script = script
    migration.executed = false
    migration.createdAt = event.block.timestamp
    migration.daoCreatedAt = dao.createdAt
    migration.save()

    const tokens = decodeTokens(script, type)
    const amounts = decodeAmounts(script, type)
    for (let i = 0; i < tokens.length; i++) {
      const assetId = migrationId + '-' + tokens[i].toHexString()
      const asset = new AssetEntity(assetId)
      asset.amount = amounts[i]
      asset.token = buildERC20(tokens[i])
      asset.migration = migrationId
      asset.save()
    }
  }
}

export function handleExecuteVote(event: ExecuteVoteEvent): void {
  const migrationId = buildMigrationId(event.address, event.params.voteId)
  const migration = MigrationEntity.load(migrationId)

  if (migration != null) {
    migration.executed = true
    migration.executedAt = event.block.timestamp
    migration.save()
  }
}

export function loadOrCreateVoting(address: Address, timestamp: BigInt): VotingEntity {
  let voting = VotingEntity.load(address.toHexString())
  if (voting == null) {
    const voting = new VotingEntity(address.toHexString())
    const votingApp = VotingContract.bind(address)
    voting.dao = votingApp.kernel().toHexString()
    voting.createdAt = timestamp
    voting.save()
  }
  return voting!
}

function buildMigrationId(voting: Address, voteId: BigInt): string {
  return voting.toHexString() + "-" + voteId.toString()
}

function buildERC20(address: Address): string {
  const id = address.toHexString()
  let token = ERC20Entity.load(id)

  if (token == null) {
    const isETH = address.toHexString() == ZERO_ADDRESS
    const tokenContract = ERC20Contract.bind(address)
    token = new ERC20Entity(id)
    const optionalName = tokenContract.try_name();
    token.name = isETH ? 'ETH' : (optionalName.reverted ? 'unknown name' : optionalName.value)
    const optionalSymbol = tokenContract.try_symbol();
    token.symbol = isETH ? 'ETH' : (optionalSymbol.reverted ? 'unknown symbol' : optionalSymbol.value)
    const optionalDecimals = tokenContract.try_decimals();
    token.decimals = isETH ? 18 : (optionalDecimals.reverted ? 0 : optionalDecimals.value)
    token.save()
  }

  return token.id
}
