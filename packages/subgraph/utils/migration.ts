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
 * Example: 0x000000016e8d25b8d912827e19bb070153e48e38ddbe5c3a00000064beabacc80000000000000000000000005bc9be34f98eb072696d63b5be5d4d2f2c03d0ad000000000000000000000000fbe66da8066711d53cf7b23f701f53f9814e8b9e0000000000000000000000000000000000000000000001b1ae4d6e2ef50000006e8d25b8d912827e19bb070153e48e38ddbe5c3a00000064beabacc8000000000000000000000000e9a083d88eed757b1d633321ce0519f432c6284d000000000000000000000000fbe66da8066711d53cf7b23f701f53f9814e8b9e00000000000000000000000000000000000000000000003635c9adc5dea000006e8d25b8d912827e19bb070153e48e38ddbe5c3a00000064beabacc80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fbe66da8066711d53cf7b23f701f53f9814e8b9e00000000000000000000000000000000000000000000000001cdda4faccd0000
 *
 * Which means that the call script body should have a length of N * 124 bytes = N * 248 chars, or
 *
 * 2. Through finance app:
 *
 * [ finance address | calldata length | fn selector | token address | executor address |  amount  | reference ]
 * [     20 bytes    |     4 bytes     |   4 bytes   |    32 bytes   |     32 bytes     | 32 bytes | 128 bytes ]
 *
 * Example: 0x0000000173237ba75084d95ada526dcf27ccc9eb99b31747000000e4f63648460000000000000000000000005bc9be34f98eb072696d63b5be5d4d2f2c03d0ad000000000000000000000000fbe66da8066711d53cf7b23f701f53f9814e8b9e0000000000000000000000000000000000000000000001b1ae4d6e2ef5000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000215472616e736665722066756e647320746f20676f7665726e206578656375746f720000000000000000000000000000000000000000000000000000000000000073237ba75084d95ada526dcf27ccc9eb99b31747000000e4f6364846000000000000000000000000e9a083d88eed757b1d633321ce0519f432c6284d000000000000000000000000fbe66da8066711d53cf7b23f701f53f9814e8b9e00000000000000000000000000000000000000000000003635c9adc5dea00000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000215472616e736665722066756e647320746f20676f7665726e206578656375746f7200000000000000000000000000000000000000000000000000000000000000
 *
 * Which means that the call script body should have a length of N * 252 bytes = N * 504 chars
 *
 */
export function decodeMigrationType(voting: VotingEntity, script: string): number {
  if (script.length <= 10) return 0

  // Assert given script is a call script
  const scriptHeader = script.substring(2, 10)
  if (scriptHeader != CALL_SCRIPT_ID) return 0

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
  for (let i = 0; i < scriptBody.length; i += VAULT_CALL_SCRIPT_MIN_LENGTH) {
    const call = scriptBody.slice(i, i + VAULT_CALL_SCRIPT_MIN_LENGTH)

    // Assert call target is the DAO's vault
    const vault = '0x' + call.substring(0, 40)
    if (!dao.vault || dao.vault.toHexString() != vault) return false

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
    if (recipient != '' && recipient != '0x' + rawRecipientAddress) return false
    else recipient = '0x' + rawRecipientAddress

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
  for (let i = 0; i < scriptBody.length; i += FINANCE_CALL_SCRIPT_MIN_LENGTH) {
    const call = scriptBody.slice(i, i + FINANCE_CALL_SCRIPT_MIN_LENGTH)

    // Assert call target is the DAO's finance app
    const finance = "0x" + call.substring(0, 40)
    if (!dao.finance || dao.finance.toHexString() != finance) return false

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
    if (recipient != '' && recipient != '0x' + rawRecipientAddress) return false
    else recipient = '0x' + rawRecipientAddress

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
    return Address.fromString('0x' + rawRecipientAddress)
  } else {
    // Finance migration
    const call = script.slice(10, FINANCE_CALL_SCRIPT_MIN_LENGTH)
    const rawRecipientAddress = call.substring(144, 184)
    return Address.fromString('0x' + rawRecipientAddress)
  }
}

export function decodeTokens(script: string, migrationType: number): Address[] {
  let tokens: Address[] = []
  const scriptBody = script.slice(10)

  if (migrationType == 1) {
    // Vault migration
    for (let i = 0; i < scriptBody.length; i += VAULT_CALL_SCRIPT_MIN_LENGTH) {
      const call = scriptBody.slice(i, i + VAULT_CALL_SCRIPT_MIN_LENGTH)
      const rawTokenAddress = call.substring(80, 120)
      const token = Address.fromString('0x' + rawTokenAddress)
      tokens.push(token)
    }
  } else {
    // Finance migration
    for (let i = 0; i < scriptBody.length; i += FINANCE_CALL_SCRIPT_MIN_LENGTH) {
      const call = scriptBody.slice(i, i + FINANCE_CALL_SCRIPT_MIN_LENGTH)
      const rawTokenAddress = call.substring(80, 120)
      const token = Address.fromString('0x' + rawTokenAddress)
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
    for (let i = 0; i < scriptBody.length; i += VAULT_CALL_SCRIPT_MIN_LENGTH) {
      const call = scriptBody.slice(i, i + VAULT_CALL_SCRIPT_MIN_LENGTH)
      const rawTransferAmount = call.substring(184, 248)
      const balance = BigInt.fromUnsignedBytes(Bytes.fromHexString('0x' + rawTransferAmount).reverse() as Bytes)
      balances.push(balance)
    }
  } else {
    // Finance migration
    for (let i = 0; i < scriptBody.length; i += FINANCE_CALL_SCRIPT_MIN_LENGTH) {
      const call = scriptBody.slice(i, i + FINANCE_CALL_SCRIPT_MIN_LENGTH)
      const rawTransferAmount = call.substring(184, 248)
      const balance = BigInt.fromUnsignedBytes(Bytes.fromHexString('0x' + rawTransferAmount).reverse() as Bytes)
      balances.push(balance)
    }
  }

  return balances
}

function occurrences(text: string, word: string): number {
  let index = 0, count = 0;

  while (true) {
    index = text.indexOf(word, index)
    if (index < 0) break;
    count++;
    index += 1;
  }

  return count;
}
