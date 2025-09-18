import { Emitter, EmitterImpl } from "../transport/emitter";

export interface WithId {
  getId(): string;
}

export interface OperationsPriorityQueue<T extends WithId> extends Emitter {
  push(...operations: T[]): boolean[];
  pushWithBackoff(operation: T): boolean;
  isEmpty(): boolean;
  pop(): T | undefined;
}

export class OperationsPriorityQueueImpl<T extends WithId>
  extends EmitterImpl
  implements OperationsPriorityQueue<T>
{
  private delayedOperations: T[];
  private nowOperations: T[];
  private readonly attempts: Record<string, number>;
  private readonly maxAttempts: number;

  public constructor(maxAttempts: number) {
    super();
    this.maxAttempts = maxAttempts;
    this.nowOperations = [];
    this.delayedOperations = [];
    this.attempts = {};
  }

  public push(...operations: T[]): boolean[] {
    const accepted = operations.map((operation) => {
      const attempts = this.newAttempt(operation);
      if (attempts > this.maxAttempts || this.alreadyInQueue(operation)) {
        return false;
      }

      this.nowOperations.push(operation);
      return true;
    });

    this.nowOperations = this.nowOperations.sort(
      (a, b) => this.getAttempts(a) - this.getAttempts(b)
    );

    return accepted;
  }

  public pushWithBackoff(operation: T): boolean {
    if (this.getAttempts(operation) === 0) {
      return this.push(operation)[0];
    }

    const attempts = this.newAttempt(operation);
    if (attempts > this.maxAttempts || this.alreadyInQueue(operation)) {
      return false;
    }

    this.delayedOperations.push(operation);

    const delayMs = this.backoffDelayInMs(attempts - 1);

    setTimeout(() => {
      this.nowOperations.push(operation);
      this.delayedOperations = this.delayedOperations.filter(
        (f) => f.getId() !== operation.getId()
      );
      this.emit(ON_OPERATION_DELAY_FINISH);
    }, delayMs);

    return true;
  }

  public isEmpty(): boolean {
    return this.nowOperations.length === 0;
  }

  public pop(): T | undefined {
    return this.nowOperations.shift();
  }

  private backoffDelayInMs(attempt: number): number {
    const random = Math.random() + 1;
    const minTimeout = 500;
    const factor = 2;
    return random * minTimeout * Math.pow(factor, attempt);
  }

  private newAttempt(operation: T): number {
    this.attempts[operation.getId()] = this.getAttempts(operation) + 1;
    return this.getAttempts(operation);
  }

  private getAttempts(operation: T): number {
    return this.attempts[operation.getId()] ?? 0;
  }

  private alreadyInQueue(operation: T): boolean {
    return (
      this.nowOperations.includes(operation) ||
      this.delayedOperations.includes(operation) ||
      Boolean(
        this.nowOperations.find((i) => i.getId() === operation.getId())
      ) ||
      Boolean(
        this.delayedOperations.find((i) => i.getId() === operation.getId())
      )
    );
  }
}

export const ON_OPERATION_DELAY_FINISH = "onOperationDelayFinish";
