/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  no-case-declarations */
import {FieldMapping, FieldMappingSourceType} from "../plugin";
import {applyTransformations, Transformation} from "./tranformations";
import {Liquid, Template} from "liquidjs";
import * as uuid from "uuid";
import {ARRAY_PATH_SEPARATOR, isArrayPath, getValue, setValue} from "./value";

const CURRENT_DATE_VAR_NAME = "CURRENT_DATE";
const CURRENT_TIME_VAR_NAME = "CURRENT_TIME";
const UUID_VAR_NAME = "UUID";
const EVENT_TEMPLATING_KEY = "record";

export interface FieldsMapperFactory {
    newFieldMapper(fieldMappings: FieldMapping[], now?: () => Date): FieldsMapper;
}

export interface FieldsMapper {
    mapEvent(
        event: object,
        transformationsMap?: Record<string, Transformation[]>,
        options?: { ignoreUnmappedProperties: boolean }
    ): Record<string, any>;
}

export class FieldsMapperFactoryImpl implements FieldsMapperFactory {
    public newFieldMapper(
        fieldMappings: FieldMapping[],
        now: () => Date = () => new Date()
    ): FieldsMapper {
        return new FieldsMapperImpl(fieldMappings, now);
    }
}

class FieldsMapperImpl implements FieldsMapper {
    private readonly fieldMappings: FieldMapping[];
    private readonly templateCache: Record<string, Template[]>;
    private readonly liquidEngine: Liquid;
    private readonly now: () => Date;

    constructor(fieldMappings: FieldMapping[], now: () => Date) {
        this.fieldMappings = fieldMappings;
        this.now = now;
        this.liquidEngine = new Liquid();

        this.templateCache = {};
        for (const mapping of this.fieldMappings) {
            if (mapping.source.type == FieldMappingSourceType.TEMPLATE) {
                const tpl = this.liquidEngine.parse(mapping.source.value);
                this.templateCache[mapping.target.name] = tpl;
            }
        }
    }

    public mapEvent(
        event: object,
        transformationsMap?: Record<string, Transformation[]>,
        options: { ignoreUnmappedProperties: boolean } = {
            ignoreUnmappedProperties: false,
        }
    ): Record<string, any> {
        if (!event || Object.keys(event).length === 0) {
            return {};
        }

        const excludedProperties = new Set<string>();

        let properties = {};
        for (const mapping of this.fieldMappings) {
            let value = null;
            switch (mapping.source.type) {
                case FieldMappingSourceType.FIELD:
                    value = getValue(event, mapping.source.value);
                    const excludeProp = mapping.source.value.startsWith("properties.");
                    if (excludeProp && isArrayPath(mapping.source.value)) {
                        excludedProperties.add(
                            mapping.source.value.split(ARRAY_PATH_SEPARATOR)[0]
                        );
                    } else if (excludeProp) {
                        excludedProperties.add(mapping.source.value);
                    }

                    break;

                case FieldMappingSourceType.TEMPLATE:
                    value = this.liquidEngine.renderSync(
                        this.templateCache[mapping.target.name],
                        {
                            [EVENT_TEMPLATING_KEY]: event,
                        }
                    );
                    break;

                case FieldMappingSourceType.CONSTANT:
                    value = mapping.source.value;
                    break;

                case FieldMappingSourceType.VARIABLE:
                    value = this.mapVariableValue(mapping);
                    break;
            }

            if (
                value &&
                transformationsMap &&
                transformationsMap[mapping.target.name]
            ) {
                value = applyTransformations(
                    value,
                    transformationsMap[mapping.target.name]
                );
            }

            if (value) {
                properties = setValue(properties, mapping.target.name, value);
            }
        }

        if (options.ignoreUnmappedProperties) {
            return properties;
        }

        const eventProps = event["properties"];
        if (eventProps) {
            for (const key in eventProps) {
                if (!excludedProperties.has("properties." + key)) {
                    properties[key] = eventProps[key];
                }
            }
        }

        return properties;
    }

    private mapVariableValue(mapping: FieldMapping): string {
        switch (mapping.source.value) {
            case CURRENT_DATE_VAR_NAME:
                return this.getCurrentUtcDate();

            case CURRENT_TIME_VAR_NAME:
                return this.getCurrentUtcTime();
            case UUID_VAR_NAME:
                return uuid.v4();
        }

        return "";
    }

    private getCurrentUtcDate(): string {
        const currentDate = this.now();
        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-indexed
        const day = String(currentDate.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    private getCurrentUtcTime(): string {
        const now = this.now();
        return now.toISOString();
    }
}
