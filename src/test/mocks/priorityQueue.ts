import { OperationsPriorityQueue, WithId } from "../../lib/lib/priorityQueue";
import { EmitterImpl } from "../../lib/transport/emitter";

export class PriorityQueueMock<T extends WithId>
  extends EmitterImpl
  implements OperationsPriorityQueue<T>
{
  private funcs: PriorityQueueMockFuncs;

  public constructor(funcs: PriorityQueueMockFuncs) {
    super();
    this.funcs = funcs;
  }

  isEmpty(): boolean {
    return this.funcs?.isEmpty();
  }

  pop(): T | undefined {
    return this.funcs?.pop();
  }

  push(...operations: T[]): boolean[] {
    return this.funcs?.push(...operations);
  }

  pushWithBackoff(operation: T): boolean {
    return this.funcs?.pushWithBackoff(operation);
  }
}

export interface PriorityQueueMockFuncs {
  isEmpty?: jest.Func;
  pop?: jest.Func;
  push?: jest.Func;
  pushWithBackoff?: jest.Func;
}
