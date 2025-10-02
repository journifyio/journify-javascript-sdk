/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  no-case-declarations */
import _ from "lodash";

export const ARRAY_PATH_SEPARATOR = ".$";

export function getValue(obj: object, path: string): any {
  if (isArrayPath(path)) {
    return getValues(obj, path);
  }

  return _.get(obj, path);
}

export function isArrayPath(path: string): boolean {
  return path.includes(ARRAY_PATH_SEPARATOR);
}

export function setValue(obj: object, path: string, value: any): object {
  if (isArrayPath(path)) {
    return setValues(obj, path, value);
  }

  return _.set(obj, path, value);
}

function getValues(data: { [key: string]: any }, path: string): any {
  const pathParts = path.split(ARRAY_PATH_SEPARATOR);
  const size = pathParts.length;

  // Return false if the path is invalid (no .$ found or more than one .$ found)
  if (size === 0 || size > 2) {
    return null;
  }

  // Get the array value from the data
  const arrayPath = pathParts[0];
  const value = getValue(data, arrayPath);
  if (!value) {
    return value;
  }

  // If the returned value is not an array, return false
  if (!Array.isArray(value)) {
    return null;
  }

  // If there is no nested path, return the array as is
  if (size === 1 || pathParts[1] === "") {
    return value;
  }

  // Get the nested path values
  const nestedPath = pathParts[1].substring(1);
  const values: any[] = [];
  let keyFound = false;

  for (const v of value) {
    const nestedValue = getValue(v, nestedPath);
    if (nestedValue !== undefined) {
      values.push(nestedValue);
      keyFound = true;
    } else {
      // Append null to keep the array size consistent with the original array
      values.push(null);
    }
  }

  if (!keyFound || values.length === 0) {
    return null;
  }

  return values;
}

function setValues(obj: object, key: string, sourceValue: any): object {
  const pathParts = key.split(ARRAY_PATH_SEPARATOR);
  const size = pathParts.length;
  // Return if the path is invalid (equals to .$, no .$ found or more than one .$ found)
  if (size === 0 || size > 2 || key === ARRAY_PATH_SEPARATOR) {
    return obj;
  }

  // If there is no nested path, replace the array with the source value
  const arrayPath = pathParts[0];
  if (size === 1 || pathParts[1] === "") {
    return setValue(obj, arrayPath, sourceValue);
  }

  // Get the array value from the record
  let value = getValue(obj, arrayPath);
  // Create the array if it doesn't exist
  if (value === undefined) {
    value = [];
  }

  // Do nothing if the returned value is not an array (when the key points to a non-array field)
  if (!Array.isArray(value)) {
    return obj;
  }
  const array = value;
  const arraySize = array.length;
  // Set the nested path values (remove the first character which is a dot)
  const nestedPath = pathParts[1].substring(1);
  // Check if sourceValue is an array
  if (Array.isArray(sourceValue)) {
    for (let i = 0; i < sourceValue.length; i++) {
      // Expand the array if needed
      if (i >= arraySize) {
        array.push({});
      }

      // Set nested values
      if (typeof array[i] === "object" && !Array.isArray(array[i])) {
        array[i] = setValue(array[i], nestedPath, sourceValue[i]);
      }
    }
  } else {
    if (arraySize === 0) {
      array.push({});
    }

    for (let i = 0; i < array.length; i++) {
      if (typeof array[i] === "object" && !Array.isArray(array[i])) {
        array[i] = setValue(array[i], nestedPath, sourceValue);
      }
    }
  }

  return setValue(obj, arrayPath, array);
}
