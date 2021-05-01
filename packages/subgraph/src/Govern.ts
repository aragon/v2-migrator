import { Executor as ExecutorEntity } from '../generated/schema'
import { Registered as RegisteredEvent } from '../generated/GovernRegistry/GovernRegistry'

export function handleRegistered(event: RegisteredEvent): void {
  const executor = new ExecutorEntity(event.params.executor.toHexString())
  executor.queue = event.params.queue
  executor.createdAt = event.block.timestamp
  executor.save()
}
