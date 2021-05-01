import { Bytes, BigInt, Address } from '@graphprotocol/graph-ts';
import { DAO as DAOEntity, Voting as VotingEntity, Executor as ExecutorEntity } from '../generated/schema'

const CALL_SCRIPT_ID = '00000001'

const VAULT_CALL_SCRIPT_MIN_LENGTH = 124 * 2;
const VAULT_TRANSFER_SIG = 'beabacc8'
const VAULT_TRANSFER_CALLDATA_LENGTH = '00000064'

const FINANCE_CALL_SCRIPT_MIN_LENGTH = 252 * 2;
const FINANCE_TRANSFER_SIG = 'f6364846'
const FINANCE_TRANSFER_CALLDATA_LENGTH = '000000e4'

/**
 * Migration scripts have one of the following structure:
 *
 * 1. Through vault app:
 *
 * [ vault address | calldata length | fn selector | token address | executor address |  amount  ]
 * [    20 bytes   |     4 bytes     |   4 bytes   |    32 bytes   |     32 bytes     | 32 bytes ]
 *
 * Which means that the call script body should have a length of N * 124 bytes = N * 248 chars, or
 *
 * 2. Through finance app:
 *
 * [ finance address | calldata length | fn selector | token address | executor address |  amount  | reference ]
 * [     20 bytes    |     4 bytes     |   4 bytes   |    32 bytes   |     32 bytes     | 32 bytes | 128 bytes ]
 *
 * Which means that the call script body should have a length of N * 252 bytes = N * 504 chars
 *
 */
export function decodeMigrationType(voting: VotingEntity, script: string): number {
  // Assert given script is a call script
  const scriptHeader = script.substring(2, 10)
  if (scriptHeader !== CALL_SCRIPT_ID) return 0

  const scriptBody = script.slice(10)
  const dao = DAOEntity.load(voting.dao)!

  // Assert call script body matches the expected length through the vault app
  if (scriptBody.length % VAULT_CALL_SCRIPT_MIN_LENGTH == 0) {
    const vault = scriptBody.substring(0, 40)
    const actualTimes = occurrences(scriptBody, vault)
    const expectedTimes = scriptBody.length / VAULT_CALL_SCRIPT_MIN_LENGTH
    if (actualTimes == expectedTimes && isValidVaultMigration(dao, scriptBody)) return 1
  }

  // Assert call script body matches the expected length through the finance app
  if (scriptBody.length % FINANCE_CALL_SCRIPT_MIN_LENGTH == 0) {
    const finance = scriptBody.substring(0, 40)
    const actualTimes = occurrences(scriptBody, finance)
    const expectedTimes = scriptBody.length / FINANCE_CALL_SCRIPT_MIN_LENGTH
    if (actualTimes == expectedTimes && isValidFinanceMigration(dao, scriptBody)) return 2
  }

  return 0
}

function isValidVaultMigration(dao: DAOEntity, scriptBody: string): boolean {
  let recipient = ''

  // Assert every call in the script body is a vault transfer to a registered govern executor
  for (let i = 0; i < scriptBody.length / VAULT_CALL_SCRIPT_MIN_LENGTH; i++) {
    const call = scriptBody.slice(i, i * VAULT_CALL_SCRIPT_MIN_LENGTH)

    // Assert call target is the DAO's vault
    const vault = `0x${call.substring(0, 40)}`
    if (!dao.vault || dao.vault.toHexString() !== vault) return false

    // Assert call data length matches a vault transfer
    const length = call.substring(40, 48)
    if (length != VAULT_TRANSFER_CALLDATA_LENGTH) return false

    // Assert call signature matches a vault transfer
    const signature = call.substring(48, 56)
    if (signature != VAULT_TRANSFER_SIG) return false

    // Assert token address
    const rawTokenAddress = call.substring(80, 120)
    if (rawTokenAddress.length != 40) return false

    // Assert transfer recipient
    const rawRecipientAddress = call.substring(144, 184)
    if (rawRecipientAddress.length != 40) return false

    // Assert recipient is equal to the previous decoded recipient
    if (recipient != '' && recipient != `0x${rawRecipientAddress}`) return false
    else recipient = `0x${rawRecipientAddress}`

    // Assert transfer amount
    const rawTransferAmount = call.substring(184, 248)
    if (rawTransferAmount.length != 64) return false
  }

  // Assert recipient is actually a govern executor
  return ExecutorEntity.load(recipient) != null
}

function isValidFinanceMigration(dao: DAOEntity, scriptBody: string): boolean {
  let recipient = ''

  // Assert every call in the script body is a finance transfer to a registered govern executor
  for (let i = 0; i < scriptBody.length / FINANCE_CALL_SCRIPT_MIN_LENGTH; i++) {
    const call = scriptBody.slice(i, i * FINANCE_CALL_SCRIPT_MIN_LENGTH)

    // Assert call target is the DAO's finance app
    const finance = `0x${call.substring(0, 40)}`
    if (!dao.finance || dao.finance.toHexString() !== finance) return false

    // Assert call data length matches a finance transfer
    const length = call.substring(40, 48)
    if (length != FINANCE_TRANSFER_CALLDATA_LENGTH) return false

    // Assert call signature matches a vault transfer
    const signature = call.substring(48, 56)
    if (signature != FINANCE_TRANSFER_SIG) return false

    // Assert token address
    const rawTokenAddress = call.substring(80, 120)
    if (rawTokenAddress.length != 40) return false

    // Assert transfer recipient
    const rawRecipientAddress = call.substring(144, 184)
    if (rawRecipientAddress.length != 40) return false

    // Assert recipient is equal to the previous decoded recipient
    if (recipient != '' && recipient != `0x${rawRecipientAddress}`) return false
    else recipient = `0x${rawRecipientAddress}`

    // Assert transfer amount
    const rawTransferAmount = call.substring(184, 248)
    if (rawTransferAmount.length != 64) return false

    // Assert transfer reference
    const reference = call.substring(248, 504)
    if (reference.length != 256) return false
  }

  // Assert recipient is actually a govern executor
  return ExecutorEntity.load(recipient) != null
}

export function decodeExecutor(script: string, migrationType: number): Address {
  if (migrationType == 1) {
    // Vault migration
    const call = script.slice(10, VAULT_CALL_SCRIPT_MIN_LENGTH)
    const rawRecipientAddress = call.substring(144, 184)
    return Address.fromString(`0x${rawRecipientAddress}`)
  } else {
    // Finance migration
    const call = script.slice(10, FINANCE_CALL_SCRIPT_MIN_LENGTH)
    const rawRecipientAddress = call.substring(144, 184)
    return Address.fromString(`0x${rawRecipientAddress}`)
  }
}

export function decodeTokens(script: string, migrationType: number): Address[] {
  let tokens: Address[] = []
  const scriptBody = script.slice(10)

  if (migrationType == 1) {
    // Vault migration
    for (let i = 0; i < scriptBody.length / VAULT_CALL_SCRIPT_MIN_LENGTH; i++) {
      const call = scriptBody.slice(i, i * VAULT_CALL_SCRIPT_MIN_LENGTH)
      const rawTokenAddress = call.substring(80, 120)
      const token = Address.fromString(`0x${rawTokenAddress}`)
      tokens.push(token)
    }
  } else {
    // Finance migration
    for (let i = 0; i < scriptBody.length / FINANCE_CALL_SCRIPT_MIN_LENGTH; i++) {
      const call = scriptBody.slice(i, i * FINANCE_CALL_SCRIPT_MIN_LENGTH)
      const rawTokenAddress = call.substring(80, 120)
      const token = Address.fromString(`0x${rawTokenAddress}`)
      tokens.push(token)
    }
  }

  return tokens
}

export function decodeAmounts(script: string, migrationType: number): BigInt[] {
  let balances: BigInt[] = []
  const scriptBody = script.slice(10)

  if (migrationType == 1) {
    // Vault migration
    for (let i = 0; i < scriptBody.length / VAULT_CALL_SCRIPT_MIN_LENGTH; i++) {
      const call = scriptBody.slice(i, i * VAULT_CALL_SCRIPT_MIN_LENGTH)
      const rawTransferAmount = call.substring(184, 248)
      const balance = BigInt.fromUnsignedBytes(Bytes.fromHexString(`0x${rawTransferAmount}`) as Bytes)
      balances.push(balance)
    }
  } else {
    // Finance migration
    for (let i = 0; i < scriptBody.length / FINANCE_CALL_SCRIPT_MIN_LENGTH; i++) {
      const call = scriptBody.slice(i, i * FINANCE_CALL_SCRIPT_MIN_LENGTH)
      const rawTransferAmount = call.substring(184, 248)
      const balance = BigInt.fromUnsignedBytes(Bytes.fromHexString(`0x${rawTransferAmount}`) as Bytes)
      balances.push(balance)
    }
  }

  return balances
}

function occurrences(text: string, word: string): number {
  let index = 0, n = 0;

  while (true) {
    index = text.indexOf(word, index + 1);
    if (index >= 0) n++;
    else break;
  }

  return n;
}
