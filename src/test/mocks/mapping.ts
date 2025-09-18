import {
  FieldsMapper,
  FieldsMapperFactory,
} from "../../lib/transport/plugins/lib/mapping";
import { FieldMapping } from "../../lib/transport/plugins/plugin";
import { JournifyEvent } from "../../lib/domain/event";
import { Transformation } from "../../lib/transport/plugins/lib/tranformations";

export class FieldsMapperFactoryMock implements FieldsMapperFactory {
  private readonly initFieldMapperFunc: (
    fieldMappings: FieldMapping[],
  ) => FieldsMapper;
  constructor(
    initFieldMapperFunc: (fieldMappings: FieldMapping[]) => FieldsMapper,
  ) {
    this.initFieldMapperFunc = initFieldMapperFunc;
  }
  public newFieldMapper(fieldMappings: FieldMapping[]): FieldsMapper {
    return this.initFieldMapperFunc(fieldMappings);
  }
}

export class FieldsMapperMock implements FieldsMapper {
  private mapEventFunc: (
    event: JournifyEvent,
    transformationsMap?: Record<string, Transformation[]>,
  ) => object;

  constructor(
    f: (
      event: JournifyEvent,
      transformationsMap?: Record<string, Transformation[]>,
    ) => object,
  ) {
    this.mapEventFunc = f;
  }

  setMapEventFunc(
    f: (
      event: JournifyEvent,
      transformationsMap?: Record<string, Transformation[]>,
    ) => object,
  ) {
    this.mapEventFunc = f;
  }

  mapEvent(
    event: JournifyEvent,
    transformationsMap?: Record<string, Transformation[]>,
  ): object {
    return this.mapEventFunc(event, transformationsMap);
  }
}
